// Per-LAN-player lane win rate, judged by net worth at the 10-minute mark.
//
// A team's safe lane (lane_role 1) shares the physical lane with the enemy's
// off lane (lane_role 3); mid (lane_role 2) faces mid. For each player we sum
// net_worth_at_10 across their own lane and across the geographically-opposing
// lane, and compare. A difference under 100 gold counts as a tie and is
// excluded entirely; lanes missing data (unparsed match, no enemy assigned to
// the lane) are also excluded.
import { getDb } from '../db.js';

// own lane_role -> opposing lane_role
const OPPOSING = { 1: 3, 2: 2, 3: 1 };

const TIE_THRESHOLD = 100;

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
    // bucket key `${isRadiant}-${laneRole}` -> { sum, count, hasNull }
    const buckets = new Map();
    for (const r of matchRows) {
      const role = r.lane_role;
      if (role !== 1 && role !== 2 && role !== 3) continue;
      const key = `${r.is_radiant ? 1 : 0}-${role}`;
      let b = buckets.get(key);
      if (!b) {
        b = { sum: 0, count: 0, hasNull: false };
        buckets.set(key, b);
      }
      b.count += 1;
      if (r.net_worth_at_10 == null) b.hasNull = true;
      else b.sum += Number(r.net_worth_at_10);
    }

    for (const r of matchRows) {
      const role = r.lane_role;
      if (role !== 1 && role !== 2 && role !== 3) continue;
      if (r.account_id == null || !lanAccountIds.has(Number(r.account_id))) continue;

      const own = buckets.get(`${r.is_radiant ? 1 : 0}-${role}`);
      const enemy = buckets.get(`${r.is_radiant ? 0 : 1}-${OPPOSING[role]}`);
      if (!own || !enemy) continue;
      if (own.count === 0 || enemy.count === 0) continue;
      if (own.hasNull || enemy.hasNull) continue;

      const diff = own.sum - enemy.sum;
      if (Math.abs(diff) < TIE_THRESHOLD) continue; // tie — excluded
      tally(Number(r.account_id), diff >= TIE_THRESHOLD);
    }
  }

  for (const t of result.values()) {
    t.rate = t.total ? t.won / t.total : 0;
  }
  return result;
}
