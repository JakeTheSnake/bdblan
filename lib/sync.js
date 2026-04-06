// Ingestion pipeline for a LAN:
//   1. For each LAN player, pull recent match history from OpenDota.
//   2. Filter to matches whose start_time falls within the LAN date window.
//   3. For every new match id, fetch the full match payload and upsert:
//      matches, match_players, match_objectives.
//   4. Link matches to the LAN via lan_matches.
//
// The raw OpenDota payload is stored verbatim in matches.raw_json so we can
// add new denormalized fields / filters later without re-fetching.

import { sql } from 'kysely';
import { getDb } from './db.js';
import { getMatch, getPlayerMatches, getHeroStats } from './opendota.js';

/** Convert a Date to unix seconds (UTC). */
function unix(d) {
  return Math.floor(d.getTime() / 1000);
}

/** Sync hero metadata table from OpenDota /heroStats. Safe to call repeatedly. */
export async function syncHeroes() {
  const db = getDb();
  const heroes = await getHeroStats();
  // OpenDota serves hero images behind its own CDN; img is a relative path
  // like "/apps/dota2/images/dota_react/heroes/antimage.png?" — build absolute.
  const absolutize = (p) => {
    if (!p) return null;
    if (p.startsWith('http')) return p;
    return `https://cdn.cloudflare.steamstatic.com${p}`;
  };

  for (const h of heroes) {
    await db
      .insertInto('heroes')
      .values({
        id: h.id,
        name: h.name,
        localized_name: h.localized_name,
        img_url: absolutize(h.img),
        icon_url: absolutize(h.icon),
        primary_attr: h.primary_attr || null,
        attack_type: h.attack_type || null,
      })
      .onDuplicateKeyUpdate({
        name: h.name,
        localized_name: h.localized_name,
        img_url: absolutize(h.img),
        icon_url: absolutize(h.icon),
        primary_attr: h.primary_attr || null,
        attack_type: h.attack_type || null,
      })
      .execute();
  }
  return heroes.length;
}

/**
 * Ingest a single match by id. No-op if already present.
 * @returns {Promise<boolean>} true if inserted, false if it already existed.
 */
export async function ingestMatch(matchId) {
  const db = getDb();

  const existing = await db
    .selectFrom('matches')
    .select('match_id')
    .where('match_id', '=', matchId)
    .executeTakeFirst();
  if (existing) return false;

  const m = await getMatch(matchId);
  if (!m || !m.match_id) return false;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('matches')
      .values({
        match_id: m.match_id,
        start_time: m.start_time,
        duration: m.duration,
        radiant_win: m.radiant_win ? 1 : 0,
        first_blood_time: m.first_blood_time ?? null,
        raw_json: JSON.stringify(m),
      })
      .execute();

    for (const p of m.players || []) {
      const goldT = Array.isArray(p.gold_t) ? p.gold_t : null;
      const lhT = Array.isArray(p.lh_t) ? p.lh_t : null;
      const dnT = Array.isArray(p.dn_t) ? p.dn_t : null;

      await trx
        .insertInto('match_players')
        .values({
          match_id: m.match_id,
          player_slot: p.player_slot,
          account_id: p.account_id ?? null,
          is_radiant: (p.player_slot & 128) === 0 ? 1 : 0,
          hero_id: p.hero_id,
          kills: p.kills ?? 0,
          deaths: p.deaths ?? 0,
          assists: p.assists ?? 0,
          last_hits: p.last_hits ?? 0,
          denies: p.denies ?? 0,
          lh_at_10: lhT && lhT.length > 10 ? lhT[10] : null,
          dn_at_10: dnT && dnT.length > 10 ? dnT[10] : null,
          net_worth: p.total_gold ?? null,
          net_worth_at_10: goldT && goldT.length > 10 ? goldT[10] : null,
          gpm: p.gold_per_min ?? null,
          xpm: p.xp_per_min ?? null,
          hero_damage: p.hero_damage ?? null,
          tower_damage: p.tower_damage ?? null,
          hero_healing: p.hero_healing ?? null,
        })
        .execute();
    }

    for (const o of m.objectives || []) {
      await trx
        .insertInto('match_objectives')
        .values({
          match_id: m.match_id,
          time: o.time ?? 0,
          type: o.type ?? 'UNKNOWN',
          team: o.team ?? null,
          key_name: typeof o.key === 'string' ? o.key : null,
          slot: o.slot ?? null,
          player_slot: o.player_slot ?? null,
        })
        .execute();
    }
  });

  return true;
}

/**
 * Core LAN sync: discover matches played by LAN players inside the LAN date
 * window and ingest them.
 * @param {number} lanId
 * @returns {Promise<{ discovered: number, ingested: number }>}
 */
export async function syncLan(lanId) {
  const db = getDb();

  const lan = await db
    .selectFrom('lans')
    .selectAll()
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) throw new Error(`LAN ${lanId} not found`);

  const players = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();

  // LAN window: from start_date 00:00:00 UTC to end_date 23:59:59 UTC.
  // Note: lan.start_date / lan.end_date come back from mysql2 as Date objects
  // (local time midnight), so normalize to a YYYY-MM-DD string first.
  const toYmd = (d) =>
    d instanceof Date
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : String(d);
  const fromYmd = toYmd(lan.start_date);
  const toYmdStr = toYmd(lan.end_date);
  const from = unix(new Date(`${fromYmd}T00:00:00Z`));
  const to = unix(new Date(`${toYmdStr}T23:59:59Z`));
  console.log(
    `[sync] LAN ${lanId} window: ${fromYmd} → ${toYmdStr} ` +
      `(unix ${from} → ${to})`,
  );

  const matchIds = new Set();
  for (const { account_id } of players) {
    const history = await getPlayerMatches(account_id);
    const total = Array.isArray(history) ? history.length : 0;
    let inWindow = 0;
    let earliest = null;
    let latest = null;
    for (const row of history) {
      if (row.start_time < (earliest ?? Infinity)) earliest = row.start_time;
      if (row.start_time > (latest ?? -Infinity)) latest = row.start_time;
      if (row.start_time >= from && row.start_time <= to) {
        matchIds.add(row.match_id);
        inWindow += 1;
      }
    }
    const fmt = (t) => (t ? new Date(t * 1000).toISOString() : '-');
    console.log(
      `[sync] player ${account_id}: ${total} matches returned, ` +
        `${inWindow} inside window; history range ${fmt(earliest)} → ${fmt(latest)}`,
    );
  }
  console.log(`[sync] LAN ${lanId} union of unique match ids: ${matchIds.size}`);

  let ingested = 0;
  for (const id of matchIds) {
    const inserted = await ingestMatch(id);
    if (inserted) ingested += 1;
    // Always (re)link to this LAN — idempotent via PK (lan_id, match_id).
    await db
      .insertInto('lan_matches')
      .values({ lan_id: lanId, match_id: id })
      .onDuplicateKeyUpdate({ lan_id: lanId })
      .execute();
  }

  await db
    .updateTable('lans')
    .set({ last_synced_at: sql`CURRENT_TIMESTAMP` })
    .where('id', '=', lanId)
    .execute();

  return { discovered: matchIds.size, ingested };
}
