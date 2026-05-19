// "Winrate given a selection of games" analytics.
//
// loadLanMatchContext builds one rich per-match object for the whole LAN;
// each selection is a pure predicate (ctx) => boolean over those objects, and
// selectionWinrate reports our winrate across the matches a predicate accepts.
//
// The loader is wrapped in React `cache()` so the WinrateSelections component
// can call selectionWinrate once per row while the DB is hit only once.
import { cache } from 'react';
import { getDb } from '../db.js';
import { ourTeamIsRadiant, didWeWin } from '../lanTeam.js';
import { computeLaneOutcomes } from '../laneWins.js';

/**
 * Per-match context for the current LAN.
 * @typedef {Object} MatchContext
 * @property {number} matchId
 * @property {boolean} won           did our team win the match
 * @property {boolean} ourRadiant    is our team radiant in this match
 * @property {{ safe, mid, off }} lanes  our team's lane outcomes ('win'|'loss'|'tie'|null)
 * @property {Array} objectives      raw match_objectives rows
 */

/**
 * Load every LAN match enriched with team side, lane outcomes and objectives.
 * Deduped per request via React cache.
 * @param {number} lanId
 * @returns {Promise<MatchContext[]>}
 */
export const loadLanMatchContext = cache(async (lanId) => {
  const db = getDb();

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

  const matches = await db
    .selectFrom('lan_matches')
    .innerJoin('matches', 'matches.match_id', 'lan_matches.match_id')
    .select(['matches.match_id', 'matches.radiant_win'])
    .where('lan_matches.lan_id', '=', lanId)
    .execute();
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.match_id);

  const players = await db
    .selectFrom('match_players')
    .select(['match_id', 'account_id', 'is_radiant', 'lane_role', 'net_worth_at_10'])
    .where('match_id', 'in', matchIds)
    .execute();

  const objectives = await db
    .selectFrom('match_objectives')
    .select(['match_id', 'type', 'key_name', 'team', 'player_slot', 'time'])
    .where('match_id', 'in', matchIds)
    .execute();

  const playersByMatch = new Map();
  for (const r of players) {
    if (!playersByMatch.has(r.match_id)) playersByMatch.set(r.match_id, []);
    playersByMatch.get(r.match_id).push(r);
  }
  const objByMatch = new Map();
  for (const o of objectives) {
    if (!objByMatch.has(o.match_id)) objByMatch.set(o.match_id, []);
    objByMatch.get(o.match_id).push(o);
  }

  return matches.map((m) => {
    const mp = playersByMatch.get(m.match_id) || [];
    const ourRadiant = ourTeamIsRadiant(mp, lanAccountIds, Number(lan?.host_account_id));
    return {
      matchId: m.match_id,
      won: didWeWin(m, ourRadiant),
      ourRadiant,
      lanes: computeLaneOutcomes(mp)[ourRadiant ? 'radiant' : 'dire'],
      objectives: objByMatch.get(m.match_id) || [],
    };
  });
});

/**
 * Our winrate across the LAN matches a predicate accepts.
 * @param {number} lanId
 * @param {(ctx: MatchContext) => boolean} predicate
 * @returns {Promise<{ wins: number, losses: number, total: number, winrate: number|null }>}
 */
export async function selectionWinrate(lanId, predicate) {
  const contexts = await loadLanMatchContext(lanId);
  let wins = 0;
  let total = 0;
  for (const ctx of contexts) {
    if (predicate(ctx) !== true) continue;
    total += 1;
    if (ctx.won) wins += 1;
  }
  return { wins, losses: total - wins, total, winrate: total ? wins / total : null };
}

// ---- Predicates --------------------------------------------------------
//
// Tier-1 tower NPC keys, keyed by owning side then lane. `goodguys` buildings
// belong to Radiant, `badguys` to Dire; a side's safe lane is bot for Radiant
// and top for Dire (the off lane is the mirror).
const TIER1_KEY = {
  radiant: {
    safe: 'npc_dota_goodguys_tower1_bot',
    mid: 'npc_dota_goodguys_tower1_mid',
    off: 'npc_dota_goodguys_tower1_top',
  },
  dire: {
    safe: 'npc_dota_badguys_tower1_top',
    mid: 'npc_dota_badguys_tower1_mid',
    off: 'npc_dota_badguys_tower1_bot',
  },
};

/** Earliest kill time of a specific building, or null if it never fell. */
function buildingKillTime(objectives, key) {
  let best = null;
  for (const o of objectives) {
    if (o.type !== 'building_kill' || o.key_name !== key) continue;
    if (best == null || o.time < best) best = o.time;
  }
  return best;
}

/** The enemy's tier-1 tower in `lane` falls strictly before ours does. */
function enemyTier1TowerFallsFirst(lane) {
  return (ctx) => {
    const ourSide = ctx.ourRadiant ? 'radiant' : 'dire';
    const theirSide = ctx.ourRadiant ? 'dire' : 'radiant';
    const theirTime = buildingKillTime(ctx.objectives, TIER1_KEY[theirSide][lane]);
    if (theirTime == null) return false; // their tower never fell
    const ourTime = buildingKillTime(ctx.objectives, TIER1_KEY[ourSide][lane]);
    if (ourTime == null) return true; // theirs fell, ours survived
    return theirTime < ourTime;
  };
}

/** The first tier-1 tower destroyed in the match belonged to the enemy. */
function weDestroyFirstTier1Tower(ctx) {
  let firstTime = null;
  let firstOwnerIsEnemy = null;
  for (const o of ctx.objectives) {
    if (o.type !== 'building_kill') continue;
    if (typeof o.key_name !== 'string' || !o.key_name.includes('_tower1_')) continue;
    if (firstTime == null || o.time < firstTime) {
      firstTime = o.time;
      const ownerRadiant = o.key_name.includes('goodguys');
      firstOwnerIsEnemy = ownerRadiant !== ctx.ourRadiant;
    }
  }
  return firstOwnerIsEnemy === true;
}

/** Our team kills a tormentor before the opponents do. */
function weKillTormentorFirst(ctx) {
  let ourTime = null;
  let theirTime = null;
  for (const o of ctx.objectives) {
    if (o.type !== 'CHAT_MESSAGE_MINIBOSS_KILL') continue;
    const isOurs = (o.team === 2) === ctx.ourRadiant; // team 2 = Radiant, 3 = Dire
    if (isOurs) {
      if (ourTime == null || o.time < ourTime) ourTime = o.time;
    } else if (theirTime == null || o.time < theirTime) {
      theirTime = o.time;
    }
  }
  if (ourTime == null) return false;
  if (theirTime == null) return true;
  return ourTime < theirTime;
}

/** Our team drew first blood. */
function weDrawFirstBlood(ctx) {
  for (const o of ctx.objectives) {
    if (o.type !== 'CHAT_MESSAGE_FIRSTBLOOD') continue;
    if (o.player_slot == null) return false;
    return (o.player_slot < 128) === ctx.ourRadiant; // slot < 128 = Radiant
  }
  return false;
}

/** Our team won exactly `n` of the three lanes (ties count as not won). */
function weWinExactlyNLanes(n) {
  return (ctx) => {
    const vals = [ctx.lanes.safe, ctx.lanes.mid, ctx.lanes.off];
    if (vals.some((v) => v == null)) return false; // unparsed — can't count lanes
    return vals.filter((v) => v === 'win').length === n;
  };
}

/** Our team won a specific lane. */
function weWinLane(lane) {
  return (ctx) => ctx.lanes[lane] === 'win';
}

export const predicates = {
  enemyTier1TowerFallsFirst,
  weDestroyFirstTier1Tower,
  weKillTormentorFirst,
  weDrawFirstBlood,
  weWinExactlyNLanes,
  weWinLane,
};
