// Highest hero damage taken by any single LAN player in one game.
//
// There is no match_players column for this: OpenDota stores damage_taken as a
// per-source breakdown (heroes, creeps, neutrals, towers, ...), so we read it
// from the stored raw payload and sum only the npc_dota_hero_* sources. That
// mirrors the "Highest damage in a game" highscore, which counts hero damage
// dealt.
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @returns {Promise<Map<number, number>>} accountId -> best single-game hero damage taken
 */
export async function getHighestDamageTakenForLan(lanId) {
  const db = getDb();

  const lanPlayers = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayers.map((p) => Number(p.account_id)));

  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .select('matches.raw_json')
    .where('lan_matches.lan_id', '=', lanId)
    .execute();

  const result = new Map();
  for (const row of rows) {
    let m = row.raw_json;
    if (typeof m === 'string') m = JSON.parse(m);
    if (!m || !Array.isArray(m.players)) continue;

    for (const p of m.players) {
      const accountId = Number(p.account_id);
      if (!lanAccountIds.has(accountId)) continue;
      const dt = p.damage_taken;
      if (!dt || typeof dt !== 'object') continue;

      let heroDamageTaken = 0;
      for (const [source, amount] of Object.entries(dt)) {
        if (source.startsWith('npc_dota_hero_')) heroDamageTaken += Number(amount) || 0;
      }

      if (heroDamageTaken > (result.get(accountId) || 0)) {
        result.set(accountId, heroDamageTaken);
      }
    }
  }
  return result;
}
