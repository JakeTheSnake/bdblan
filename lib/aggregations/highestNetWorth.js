// Highest net worth any single LAN player reached in one game.
import { sql } from 'kysely';
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @returns {Promise<Map<number, number>>} accountId -> best single-game net worth
 */
export async function getHighestNetWorthForLan(lanId) {
  const db = getDb();

  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('match_players', 'match_players.match_id', 'lan_matches.match_id')
    .innerJoin('lan_players', (join) =>
      join
        .onRef('lan_players.account_id', '=', 'match_players.account_id')
        .on('lan_players.lan_id', '=', lanId),
    )
    .select([
      'match_players.account_id',
      sql`MAX(COALESCE(match_players.net_worth, 0))`.as('best_net_worth'),
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .groupBy('match_players.account_id')
    .execute();

  const result = new Map();
  for (const r of rows) {
    result.set(Number(r.account_id), Number(r.best_net_worth));
  }
  return result;
}
