// Per-LAN-player lane win rate, judged by net worth at the 10-minute mark.
//
// The lane-win resolution itself lives in lib/laneWins.js
// (computeLaneOutcomes); here we just tally each LAN attendee's own-lane
// result across every LAN match. A tie or a lane missing data is excluded.
import { getDb } from '../db.js';
import { computeLaneOutcomes } from '../laneWins.js';

const ROLE_NAME = { 1: 'safe', 2: 'mid', 3: 'off' };

/**
 * @param {number} lanId
 * @returns {Promise<Map<number, { won: number, total: number, rate: number }>>}
 *   accountId -> lane win/total counts and rate (won / total)
 */
export async function getLaneWinRatesForLan(lanId) {
  const db = getDb();

  const lanPlayers = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayers.map((p) => Number(p.account_id)));

  // Every player in every LAN match — not just LAN attendees — since we need
  // both whole lanes to sum their net worth.
  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('match_players', 'match_players.match_id', 'lan_matches.match_id')
    .select([
      'match_players.match_id',
      'match_players.account_id',
      'match_players.is_radiant',
      'match_players.lane_role',
      'match_players.net_worth_at_10',
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .execute();

  // Group rows by match.
  const byMatch = new Map();
  for (const r of rows) {
    if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []);
    byMatch.get(r.match_id).push(r);
  }

  const result = new Map();
  const tally = (accountId, won) => {
    let t = result.get(accountId);
    if (!t) {
      t = { won: 0, total: 0, rate: 0 };
      result.set(accountId, t);
    }
    t.total += 1;
    if (won) t.won += 1;
  };

  for (const matchRows of byMatch.values()) {
    const outcomes = computeLaneOutcomes(matchRows);
    for (const r of matchRows) {
      const role = ROLE_NAME[r.lane_role];
      if (!role) continue;
      if (r.account_id == null || !lanAccountIds.has(Number(r.account_id))) continue;

      const outcome = outcomes[r.is_radiant ? 'radiant' : 'dire'][role];
      if (outcome === 'win') tally(Number(r.account_id), true);
      else if (outcome === 'loss') tally(Number(r.account_id), false);
      // 'tie' / null — excluded
    }
  }

  for (const t of result.values()) {
    t.rate = t.total ? t.won / t.total : 0;
  }
  return result;
}
