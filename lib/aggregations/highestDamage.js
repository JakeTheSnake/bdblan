// Highest hero damage any single LAN player dealt in one game, plus the hero
// they played in that game.
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @returns {Promise<Map<number, { value: number, hero_id: number, hero_icon: string|null, match_id: number }>>}
 *   accountId -> best single-game hero damage, the hero played, and that match
 */
export async function getHighestDamageForLan(lanId) {
  const db = getDb();

  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('match_players', 'match_players.match_id', 'lan_matches.match_id')
    .innerJoin('lan_players', (join) =>
      join
        .onRef('lan_players.account_id', '=', 'match_players.account_id')
        .on('lan_players.lan_id', '=', lanId),
    )
    .leftJoin('heroes', 'heroes.id', 'match_players.hero_id')
    .select([
      'match_players.account_id',
      'match_players.match_id',
      'match_players.hero_id',
      'heroes.icon_url as hero_icon',
      'match_players.hero_damage',
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .execute();

  const result = new Map();
  for (const r of rows) {
    const accountId = Number(r.account_id);
    const value = Number(r.hero_damage) || 0;
    const prev = result.get(accountId);
    if (!prev || value > prev.value) {
      result.set(accountId, {
        value,
        hero_id: r.hero_id,
        hero_icon: r.hero_icon || null,
        match_id: Number(r.match_id),
      });
    }
  }
  return result;
}
