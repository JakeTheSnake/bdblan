// Support (position 4/5) ward highscores: avg wards placed and avg dewards.
//
// OpenDota has no position field, so supports are inferred per match: on each
// team, the two players who bought the most sentry wards are its supports
// (tie-broken by lower net worth, then player slot).
//
// A LAN player's game counts toward these averages only when (a) they were one
// of those two supports and (b) the match was parsed by OpenDota — unparsed
// matches have no ward data (obs_placed is NULL) and are skipped entirely.
import { getDb } from '../db.js';

/** The two highest sentry buyers on a team are its supports. */
function teamSupports(team) {
  return [...team]
    .sort((a, b) => {
      const bySentry = (b.sentry_bought ?? -1) - (a.sentry_bought ?? -1);
      if (bySentry !== 0) return bySentry;
      const byNetWorth = (a.net_worth ?? Infinity) - (b.net_worth ?? Infinity);
      if (byNetWorth !== 0) return byNetWorth;
      return a.player_slot - b.player_slot;
    })
    .slice(0, 2);
}

/**
 * @param {number} lanId
 * @returns {Promise<{ wardsPlaced: Map<number, number>, dewards: Map<number, number> }>}
 *   accountId -> average per support game (rounded to 1 decimal)
 */
export async function getSupportWardStatsForLan(lanId) {
  const db = getDb();

  // All 10 players of every LAN match — the full team is needed to rank
  // supports, so we cannot pre-filter to LAN players here.
  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('match_players', 'match_players.match_id', 'lan_matches.match_id')
    .select([
      'match_players.match_id',
      'match_players.account_id',
      'match_players.is_radiant',
      'match_players.player_slot',
      'match_players.net_worth',
      'match_players.sentry_bought',
      'match_players.obs_placed',
      'match_players.sen_placed',
      'match_players.observer_kills',
      'match_players.sentry_kills',
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .execute();

  const byMatch = new Map();
  for (const r of rows) {
    if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []);
    byMatch.get(r.match_id).push(r);
  }

  // accountId -> { placedSum, dewardSum, games }
  const acc = new Map();
  for (const players of byMatch.values()) {
    for (const side of [true, false]) {
      const team = players.filter((p) => !!p.is_radiant === side);
      for (const p of teamSupports(team)) {
        // Skip non-parsed games (no ward data) and anonymous players.
        if (p.account_id == null || p.obs_placed == null) continue;
        const id = Number(p.account_id);
        if (!acc.has(id)) acc.set(id, { placedSum: 0, dewardSum: 0, games: 0 });
        const a = acc.get(id);
        a.placedSum += (p.obs_placed ?? 0) + (p.sen_placed ?? 0);
        a.dewardSum += (p.observer_kills ?? 0) + (p.sentry_kills ?? 0);
        a.games += 1;
      }
    }
  }

  const wardsPlaced = new Map();
  const dewards = new Map();
  const avg = (sum, games) => Math.round((sum / games) * 10) / 10;
  for (const [id, a] of acc) {
    if (a.games === 0) continue;
    wardsPlaced.set(id, avg(a.placedSum, a.games));
    dewards.set(id, avg(a.dewardSum, a.games));
  }
  return { wardsPlaced, dewards };
}
