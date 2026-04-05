// Per-player stats scoped to a LAN.
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @param {number} accountId
 */
export async function getPlayerStats(lanId, accountId) {
  const db = getDb();

  const player = await db
    .selectFrom('players')
    .selectAll()
    .where('account_id', '=', accountId)
    .executeTakeFirst();
  if (!player) return null;

  // All match_players rows for this account inside the LAN.
  const rows = await db
    .selectFrom('lan_matches')
    .innerJoin('match_players', 'match_players.match_id', 'lan_matches.match_id')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .leftJoin('heroes', 'heroes.id', 'match_players.hero_id')
    .select([
      'match_players.match_id',
      'match_players.hero_id',
      'heroes.localized_name as hero_name',
      'heroes.img_url as hero_img',
      'match_players.kills',
      'match_players.deaths',
      'match_players.assists',
      'match_players.net_worth_at_10',
      'match_players.is_radiant',
      'matches.radiant_win',
      'matches.duration',
      'matches.start_time',
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .where('match_players.account_id', '=', accountId)
    .execute();

  const heroCounts = new Map();
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  const nw10s = [];
  let wins = 0;

  for (const r of rows) {
    const key = r.hero_id;
    if (!heroCounts.has(key)) {
      heroCounts.set(key, {
        hero_id: r.hero_id,
        hero_name: r.hero_name,
        hero_img: r.hero_img,
        count: 0,
      });
    }
    heroCounts.get(key).count += 1;

    kills += r.kills || 0;
    deaths += r.deaths || 0;
    assists += r.assists || 0;
    if (r.net_worth_at_10 != null) nw10s.push(r.net_worth_at_10);
    if ((!!r.is_radiant) === (!!r.radiant_win)) wins += 1;
  }

  const heroesSorted = [...heroCounts.values()].sort((a, b) => b.count - a.count);
  const mostPlayed = heroesSorted[0] || null;

  const nw10Stats = nw10s.length
    ? {
        min: Math.min(...nw10s),
        max: Math.max(...nw10s),
        avg: Math.round(nw10s.reduce((a, b) => a + b, 0) / nw10s.length),
      }
    : null;

  return {
    player,
    totals: {
      matches: rows.length,
      wins,
      losses: rows.length - wins,
      kills,
      deaths,
      assists,
    },
    mostPlayedHero: mostPlayed,
    heroes: heroesSorted,
    netWorthAt10: nw10Stats,
    matches: rows,
  };
}
