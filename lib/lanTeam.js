// Helpers for reasoning about "our team" in a LAN match — i.e. the side
// (radiant or dire) that the LAN's attending players played on. This is the
// side rendered in green in the match view and counted as W/L.
//
// Rule: for a given match, our team = the side that contains the most LAN
// players. Tie-breaker: the side containing the LAN host. If neither side
// contains any LAN player (shouldn't happen for a properly-synced LAN), we
// fall back to radiant.

/**
 * @param {Array<{ account_id: number|null, is_radiant: number|boolean }>} matchPlayers
 * @param {Set<number>} lanAccountIds
 * @param {number} hostAccountId
 * @returns {boolean} true if "our team" is radiant
 */
export function ourTeamIsRadiant(matchPlayers, lanAccountIds, hostAccountId) {
  let radiantCount = 0;
  let direCount = 0;
  let hostRadiant = null;
  for (const p of matchPlayers) {
    if (p.account_id == null || !lanAccountIds.has(Number(p.account_id))) continue;
    const isR = !!p.is_radiant;
    if (isR) radiantCount += 1;
    else direCount += 1;
    if (Number(p.account_id) === Number(hostAccountId)) hostRadiant = isR;
  }
  if (radiantCount !== direCount) return radiantCount > direCount;
  if (hostRadiant != null) return hostRadiant;
  return true;
}

/**
 * @param {{ radiant_win: number|boolean }} match
 * @param {boolean} ourTeamRadiant
 */
export function didWeWin(match, ourTeamRadiant) {
  return !!match.radiant_win === ourTeamRadiant;
}
