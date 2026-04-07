// Unique hero count per LAN player.
import { sql } from 'kysely';
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @returns {Promise<Map<number, number>>} accountId -> unique hero count
 */
export async function getUniqueHeroCountsForLan(lanId) {
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
      sql`COUNT(DISTINCT match_players.hero_id)`.as('unique_heroes'),
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .groupBy('match_players.account_id')
    .execute();

  const result = new Map();
  for (const r of rows) {
    result.set(Number(r.account_id), Number(r.unique_heroes));
  }
  return result;
}
