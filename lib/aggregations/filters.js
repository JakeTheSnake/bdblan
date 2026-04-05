// Composable match filter API for "games where condition X" analytics.
//
// Each condition is a function (qb, ctx) => qb that narrows a Kysely query
// over the LAN's matches. ctx carries the LAN id and a pre-built subquery of
// lan_matches. Conditions can be combined with AND semantics.
//
// The initial set supports the examples from the design:
//   - mid tower destroyed before N seconds
//   - first blood before N seconds
//   - our team net worth @ 10 min > threshold
//
// More conditions can be added later without touching the callers.

import { sql } from 'kysely';
import { getDb } from '../db.js';
import { ourTeamIsRadiant } from '../lanTeam.js';

/**
 * Build a query that returns [{match_id, duration, radiant_win, start_time}]
 * for the given LAN with the given conditions applied.
 *
 * @param {number} lanId
 * @param {Array<(qb: any) => any>} conditions
 */
async function baseLanMatches(lanId, conditions) {
  const db = getDb();
  let qb = db
    .selectFrom('lan_matches')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .select([
      'matches.match_id',
      'matches.duration',
      'matches.radiant_win',
      'matches.start_time',
      'matches.first_blood_time',
    ])
    .where('lan_matches.lan_id', '=', lanId);
  for (const cond of conditions) qb = cond(qb);
  return qb.execute();
}

// ---- Conditions --------------------------------------------------------

/** Mid tier-1/2/3 tower (either side's "mid" tower) killed before N seconds. */
export function midTowerKilledBefore(seconds) {
  return (qb) =>
    qb.where((eb) =>
      eb.exists(
        eb
          .selectFrom('match_objectives')
          .select(sql`1`.as('one'))
          .whereRef('match_objectives.match_id', '=', 'matches.match_id')
          .where('match_objectives.type', '=', 'CHAT_MESSAGE_TOWER_KILL')
          .where('match_objectives.key_name', 'like', '%tower%mid%')
          .where('match_objectives.time', '<', seconds),
      ),
    );
}

/** First blood happened before N seconds (either side). */
export function firstBloodBefore(seconds) {
  return (qb) => qb.where('matches.first_blood_time', '<', seconds);
}

/** Duration longer/shorter than N seconds. */
export function durationGreaterThan(seconds) {
  return (qb) => qb.where('matches.duration', '>', seconds);
}
export function durationLessThan(seconds) {
  return (qb) => qb.where('matches.duration', '<', seconds);
}

// ------------------------------------------------------------------------

/**
 * Run a filtered query and compute winrate from the LAN's perspective.
 * We need per-match "our team" resolution, so we post-filter in JS for that.
 *
 * @param {number} lanId
 * @param {Array} conditions
 * @returns {Promise<{matches: any[], wins: number, losses: number, winrate: number}>}
 */
export async function runFilter(lanId, conditions = []) {
  const db = getDb();
  const matches = await baseLanMatches(lanId, conditions);

  const lan = await db
    .selectFrom('lans')
    .select(['host_account_id'])
    .where('id', '=', lanId)
    .executeTakeFirst();

  const lanPlayers = await db
    .selectFrom('lan_players')
    .select('account_id')
    .where('lan_id', '=', lanId)
    .execute();
  const lanAccountIds = new Set(lanPlayers.map((r) => Number(r.account_id)));

  const mp = matches.length
    ? await db
        .selectFrom('match_players')
        .select(['match_id', 'account_id', 'is_radiant'])
        .where('match_id', 'in', matches.map((m) => m.match_id))
        .execute()
    : [];
  const byMatch = new Map();
  for (const r of mp) {
    if (!byMatch.has(r.match_id)) byMatch.set(r.match_id, []);
    byMatch.get(r.match_id).push(r);
  }

  let wins = 0;
  const enriched = matches.map((m) => {
    const ourRadiant = ourTeamIsRadiant(
      byMatch.get(m.match_id) || [],
      lanAccountIds,
      Number(lan?.host_account_id),
    );
    const won = !!m.radiant_win === ourRadiant;
    if (won) wins += 1;
    return { ...m, ourRadiant, won };
  });

  return {
    matches: enriched,
    wins,
    losses: enriched.length - wins,
    winrate: enriched.length ? wins / enriched.length : 0,
  };
}
