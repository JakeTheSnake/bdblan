// For each teamfight in a LAN's matches, decide whether "our team" had more
// participating heroes than the enemy, split by matches we won vs lost — to see
// whether teamfight numbers advantage correlates with winning.
import { getDb } from '../db.js';
import { ourTeamIsRadiant, didWeWin } from '../lanTeam.js';

// A teamfight lists all 10 heroes regardless of who actually fought. Count a
// hero as a participant if they died, dealt hero damage (teamfight `damage` is
// hero damage only), or healed enough to rule out passive regen / potions.
function participated(p) {
  return !!p && (p.deaths > 0 || p.damage > 0 || p.healing > 200);
}

/**
 * @param {number} lanId
 * @returns {Promise<{
 *   wins: { fights: number, advantage: number },
 *   losses: { fights: number, advantage: number },
 * }>}
 */
export async function getTeamfightAdvantageForLan(lanId) {
  const db = getDb();
  const empty = { wins: { fights: 0, advantage: 0 }, losses: { fights: 0, advantage: 0 } };

  const lan = await db
    .selectFrom('lans')
    .select('host_account_id')
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) return empty;

  const lanPlayerRows = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayerRows.map((r) => Number(r.account_id)));

  const matchRows = await db
    .selectFrom('lan_matches')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .select(['matches.match_id', 'matches.raw_json'])
    .where('lan_matches.lan_id', '=', lanId)
    .execute();
  if (!matchRows.length) return empty;

  const wins = { fights: 0, advantage: 0 };
  const losses = { fights: 0, advantage: 0 };

  for (const row of matchRows) {
    const raw = typeof row.raw_json === 'string' ? JSON.parse(row.raw_json) : row.raw_json;
    const players = raw?.players;
    const teamfights = raw?.teamfights;
    if (!Array.isArray(players) || !Array.isArray(teamfights)) continue;

    const matchPlayers = players.map((p) => ({
      account_id: p.account_id,
      is_radiant: p.player_slot < 128,
    }));
    const ourRadiant = ourTeamIsRadiant(matchPlayers, lanAccountIds, Number(lan.host_account_id));
    const bucket = didWeWin({ radiant_win: raw.radiant_win }, ourRadiant) ? wins : losses;

    const ourIndices = [];
    const theirIndices = [];
    players.forEach((p, i) => {
      if ((p.player_slot < 128) === ourRadiant) ourIndices.push(i);
      else theirIndices.push(i);
    });

    for (const tf of teamfights) {
      const tfp = tf?.players || [];
      const ourCount = ourIndices.filter((i) => participated(tfp[i])).length;
      const theirCount = theirIndices.filter((i) => participated(tfp[i])).length;
      bucket.fights += 1;
      if (ourCount > theirCount) bucket.advantage += 1;
    }
  }

  return { wins, losses };
}
