// Count "ez" messages in match chat from LAN players.
import { getDb } from '../db.js';

/**
 * @param {number} lanId
 * @returns {Promise<{ total: number, byPlayer: Map<number, number> }>}
 */
export async function getEzCountsForLan(lanId) {
  const db = getDb();

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

  if (!matchRows.length) return { total: 0, byPlayer: new Map() };

  const mpRows = await db
    .selectFrom('match_players')
    .select(['match_id', 'player_slot', 'account_id'])
    .where(
      'match_id',
      'in',
      matchRows.map((r) => r.match_id),
    )
    .execute();

  // Build lookup: "matchId:playerSlot" -> accountId
  const slotToAccount = new Map();
  for (const mp of mpRows) {
    if (mp.account_id != null) {
      slotToAccount.set(`${mp.match_id}:${mp.player_slot}`, Number(mp.account_id));
    }
  }

  let total = 0;
  const byPlayer = new Map();

  for (const row of matchRows) {
    const raw = typeof row.raw_json === 'string' ? JSON.parse(row.raw_json) : row.raw_json;
    const chat = raw?.chat || [];

    for (const msg of chat) {
      if (msg.type !== 'chat') continue;
      if (!msg.key || !msg.key.toLowerCase().includes('ez')) continue;

      const accountId = slotToAccount.get(`${row.match_id}:${msg.player_slot}`);
      if (accountId == null || !lanAccountIds.has(accountId)) continue;

      total += 1;
      byPlayer.set(accountId, (byPlayer.get(accountId) || 0) + 1);
    }
  }

  return { total, byPlayer };
}
