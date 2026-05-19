// Lane-win resolution, judged by net worth at the 10-minute mark.
//
// A team's safe lane (lane_role 1) shares the physical lane with the enemy's
// off lane (lane_role 3); mid (lane_role 2) faces mid. We sum net_worth_at_10
// across each lane and compare it to the geographically-opposing enemy lane.
// A difference under 100 gold is a tie; a lane missing data (unparsed match,
// no enemy assigned to the opposing lane) resolves to null.

// own lane_role -> geographically opposing lane_role
const OPPOSING = { 1: 3, 2: 2, 3: 1 };

const TIE_THRESHOLD = 100;

/**
 * Resolve each side's three lanes for a single match.
 *
 * @param {Array<{ is_radiant: number|boolean, lane_role: number|null, net_worth_at_10: number|null }>} matchPlayers
 * @returns {{
 *   radiant: { safe: string|null, mid: string|null, off: string|null },
 *   dire:    { safe: string|null, mid: string|null, off: string|null }
 * }} each lane value is 'win' | 'loss' | 'tie' | null
 */
export function computeLaneOutcomes(matchPlayers) {
  // bucket key `${isRadiant}-${laneRole}` -> { sum, count, hasNull }
  const buckets = new Map();
  for (const r of matchPlayers) {
    const role = r.lane_role;
    if (role !== 1 && role !== 2 && role !== 3) continue;
    const key = `${r.is_radiant ? 1 : 0}-${role}`;
    let b = buckets.get(key);
    if (!b) {
      b = { sum: 0, count: 0, hasNull: false };
      buckets.set(key, b);
    }
    b.count += 1;
    if (r.net_worth_at_10 == null) b.hasNull = true;
    else b.sum += Number(r.net_worth_at_10);
  }

  const resolve = (isRadiant, role) => {
    const own = buckets.get(`${isRadiant ? 1 : 0}-${role}`);
    const enemy = buckets.get(`${isRadiant ? 0 : 1}-${OPPOSING[role]}`);
    if (!own || !enemy) return null;
    if (own.count === 0 || enemy.count === 0) return null;
    if (own.hasNull || enemy.hasNull) return null;
    const diff = own.sum - enemy.sum;
    if (Math.abs(diff) < TIE_THRESHOLD) return 'tie';
    return diff >= TIE_THRESHOLD ? 'win' : 'loss';
  };

  const sideOutcomes = (isRadiant) => ({
    safe: resolve(isRadiant, 1),
    mid: resolve(isRadiant, 2),
    off: resolve(isRadiant, 3),
  });

  return { radiant: sideOutcomes(true), dire: sideOutcomes(false) };
}
