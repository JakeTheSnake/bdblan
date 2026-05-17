// Total Roshan and Tormentor kills by "our team", summed over all LAN matches.
import { getDb } from '../db.js';
import { ourTeamIsRadiant } from '../lanTeam.js';

const ROSHAN_TYPE = 'CHAT_MESSAGE_ROSHAN_KILL';
const TORMENTOR_TYPE = 'CHAT_MESSAGE_MINIBOSS_KILL';

/**
 * @param {number} lanId
 * @returns {Promise<{ roshanKills: number, tormentorKills: number }>}
 */
export async function getObjectiveKillsForLan(lanId) {
  const db = getDb();

  const lan = await db
    .selectFrom('lans')
    .select('host_account_id')
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) return { roshanKills: 0, tormentorKills: 0 };

  const lanPlayerRows = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayerRows.map((r) => Number(r.account_id)));

  const matchRows = await db
    .selectFrom('lan_matches')
    .select('match_id')
    .where('lan_id', '=', lanId)
    .execute();
  if (!matchRows.length) return { roshanKills: 0, tormentorKills: 0 };
  const matchIds = matchRows.map((r) => r.match_id);

  // Resolve "our team" (radiant or dire) per match.
  const mpRows = await db
    .selectFrom('match_players')
    .select(['match_id', 'account_id', 'is_radiant'])
    .where('match_id', 'in', matchIds)
    .execute();
  const playersByMatch = new Map();
  for (const mp of mpRows) {
    const key = String(mp.match_id);
    if (!playersByMatch.has(key)) playersByMatch.set(key, []);
    playersByMatch.get(key).push(mp);
  }
  const ourRadiantByMatch = new Map();
  for (const [key, players] of playersByMatch) {
    ourRadiantByMatch.set(
      key,
      ourTeamIsRadiant(players, lanAccountIds, Number(lan.host_account_id)),
    );
  }

  const objectives = await db
    .selectFrom('match_objectives')
    .select(['match_id', 'type', 'team'])
    .where('match_id', 'in', matchIds)
    .where('type', 'in', [ROSHAN_TYPE, TORMENTOR_TYPE])
    .execute();

  // team field in OpenDota objectives: 2=radiant, 3=dire.
  let roshanKills = 0;
  let tormentorKills = 0;
  for (const o of objectives) {
    if (o.team == null) continue;
    const ourRadiant = ourRadiantByMatch.get(String(o.match_id));
    if (ourRadiant == null) continue;
    const isUs = (o.team === 2) === ourRadiant;
    if (!isUs) continue;
    if (o.type === ROSHAN_TYPE) roshanKills += 1;
    else tormentorKills += 1;
  }

  return { roshanKills, tormentorKills };
}
