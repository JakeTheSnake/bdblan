// LAN-wide aggregate: wins/losses, total/avg duration, fastest win/loss.
import { getDb } from '../db.js';
import { ourTeamIsRadiant, didWeWin } from '../lanTeam.js';

/**
 * @param {number} lanId
 */
export async function getLanSummary(lanId) {
  const db = getDb();

  const lan = await db
    .selectFrom('lans')
    .selectAll()
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) return null;

  const lanPlayers = await db
    .selectFrom('lan_players')
    .innerJoin('players', 'players.account_id', 'lan_players.account_id')
    .select(['players.account_id', 'players.persona_name', 'players.avatar_url'])
    .where('lan_players.lan_id', '=', lanId)
    .execute();

  const lanAccountIds = new Set(lanPlayers.map((p) => Number(p.account_id)));

  const matches = await db
    .selectFrom('lan_matches')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .select([
      'matches.match_id',
      'matches.start_time',
      'matches.duration',
      'matches.radiant_win',
    ])
    .where('lan_matches.lan_id', '=', lanId)
    .orderBy('matches.start_time', 'asc')
    .execute();

  // Pull slot info for all matches in one query, then group by match id.
  const mpRows = matches.length
    ? await db
        .selectFrom('match_players')
        .select(['match_id', 'account_id', 'is_radiant'])
        .where('match_id', 'in', matches.map((m) => m.match_id))
        .execute()
    : [];
  const mpByMatch = new Map();
  for (const r of mpRows) {
    if (!mpByMatch.has(r.match_id)) mpByMatch.set(r.match_id, []);
    mpByMatch.get(r.match_id).push(r);
  }

  let wins = 0;
  let losses = 0;
  let totalDuration = 0;
  let fastestWin = null;
  let fastestLoss = null;
  const enriched = [];

  for (const m of matches) {
    const slots = mpByMatch.get(m.match_id) || [];
    const ourRadiant = ourTeamIsRadiant(slots, lanAccountIds, Number(lan.host_account_id));
    const won = didWeWin(m, ourRadiant);
    totalDuration += m.duration;
    if (won) {
      wins += 1;
      if (!fastestWin || m.duration < fastestWin.duration) fastestWin = m;
    } else {
      losses += 1;
      if (!fastestLoss || m.duration < fastestLoss.duration) fastestLoss = m;
    }
    enriched.push({ ...m, ourRadiant, won });
  }

  const total = matches.length;
  return {
    lan,
    players: lanPlayers,
    totals: {
      matches: total,
      wins,
      losses,
      winrate: total ? wins / total : 0,
      totalDurationSec: totalDuration,
      avgDurationSec: total ? Math.round(totalDuration / total) : 0,
      fastestWin,
      fastestLoss,
    },
    matches: enriched,
  };
}
