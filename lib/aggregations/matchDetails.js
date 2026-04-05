// Single match details for the match view.
import { getDb } from '../db.js';
import { ourTeamIsRadiant } from '../lanTeam.js';

const TOWER_TYPES = new Set(['CHAT_MESSAGE_TOWER_KILL', 'CHAT_MESSAGE_TOWER_DENY', 'building_kill']);
const ROSHAN_TYPES = new Set(['CHAT_MESSAGE_ROSHAN_KILL']);
const TORMENTOR_TYPES = new Set(['CHAT_MESSAGE_MINIBOSS_KILL']);

/**
 * @param {number} lanId
 * @param {string|number} matchId
 */
export async function getMatchDetails(lanId, matchId) {
  const db = getDb();
  const mid = typeof matchId === 'string' ? matchId : String(matchId);

  const match = await db
    .selectFrom('matches')
    .selectAll()
    .where('match_id', '=', mid)
    .executeTakeFirst();
  if (!match) return null;

  const lan = await db
    .selectFrom('lans')
    .selectAll()
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) return null;

  const lanPlayerRows = await db
    .selectFrom('lan_players')
    .innerJoin('players', 'players.account_id', 'lan_players.account_id')
    .select(['players.account_id', 'players.persona_name'])
    .where('lan_players.lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayerRows.map((r) => Number(r.account_id)));
  const personaByAccount = new Map(lanPlayerRows.map((r) => [Number(r.account_id), r.persona_name]));

  const players = await db
    .selectFrom('match_players')
    .leftJoin('heroes', 'heroes.id', 'match_players.hero_id')
    .select([
      'match_players.account_id',
      'match_players.player_slot',
      'match_players.is_radiant',
      'match_players.hero_id',
      'heroes.localized_name as hero_name',
      'heroes.img_url as hero_img',
      'match_players.kills',
      'match_players.deaths',
      'match_players.assists',
      'match_players.net_worth',
      'match_players.net_worth_at_10',
      'match_players.gpm',
      'match_players.xpm',
    ])
    .where('match_players.match_id', '=', mid)
    .orderBy('match_players.player_slot', 'asc')
    .execute();

  const ourRadiant = ourTeamIsRadiant(players, lanAccountIds, Number(lan.host_account_id));
  const weWon = !!match.radiant_win === ourRadiant;

  const enrichedPlayers = players.map((p) => ({
    ...p,
    is_us: !!p.is_radiant === ourRadiant,
    persona_name: p.account_id != null ? personaByAccount.get(Number(p.account_id)) || null : null,
    is_lan_player: p.account_id != null && lanAccountIds.has(Number(p.account_id)),
  }));

  const objectives = await db
    .selectFrom('match_objectives')
    .selectAll()
    .where('match_id', '=', mid)
    .orderBy('time', 'asc')
    .execute();

  // team field in OpenDota objectives: 2=radiant, 3=dire.
  const classify = (o) => {
    if (o.team == null) return null;
    const isRadiant = o.team === 2;
    return { is_us: isRadiant === ourRadiant, isRadiant };
  };

  const towers = objectives
    .filter((o) => TOWER_TYPES.has(o.type))
    .map((o) => ({ time: o.time, key: o.key_name, ...(classify(o) || {}) }));
  const roshans = objectives
    .filter((o) => ROSHAN_TYPES.has(o.type))
    .map((o) => ({ time: o.time, ...(classify(o) || {}) }));
  const tormentors = objectives
    .filter((o) => TORMENTOR_TYPES.has(o.type))
    .map((o) => ({ time: o.time, ...(classify(o) || {}) }));

  return {
    match,
    ourRadiant,
    weWon,
    usPlayers: enrichedPlayers.filter((p) => p.is_us),
    themPlayers: enrichedPlayers.filter((p) => !p.is_us),
    towers,
    roshans,
    tormentors,
  };
}
