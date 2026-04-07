import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { sql } from 'kysely';
import { getDb } from '@/lib/db.js';
import { getPlayer } from '@/lib/opendota.js';
import { syncLan } from '@/lib/sync.js';

// POST /api/admin/lans
// Body: { name, startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD",
//         players: [{accountId, personaName?}], hostAccountId }
export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const { name, startDate, endDate, players, hostAccountId } = body;
  if (!name || !startDate || !endDate || !Array.isArray(players) || players.length === 0 || !hostAccountId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  if (!players.some((p) => Number(p.accountId) === Number(hostAccountId))) {
    return NextResponse.json({ error: 'host must be among players' }, { status: 400 });
  }

  const db = getDb();

  // Upsert players. Try to enrich missing persona names from OpenDota.
  for (const p of players) {
    let persona = p.personaName || '';
    let avatar = null;
    if (!persona) {
      try {
        const od = await getPlayer(p.accountId);
        persona = od?.profile?.personaname || String(p.accountId);
        avatar = od?.profile?.avatarfull || null;
      } catch {
        persona = String(p.accountId);
      }
    }
    await db
      .insertInto('players')
      .values({
        account_id: p.accountId,
        persona_name: persona,
        avatar_url: avatar,
        last_synced_at: sql`CURRENT_TIMESTAMP`,
      })
      .onDuplicateKeyUpdate({
        persona_name: persona,
        ...(avatar ? { avatar_url: avatar } : {}),
        last_synced_at: sql`CURRENT_TIMESTAMP`,
      })
      .execute();
  }

  const result = await db
    .insertInto('lans')
    .values({
      name,
      start_date: startDate,
      end_date: endDate,
      host_account_id: hostAccountId,
    })
    .executeTakeFirstOrThrow();
  const lanId = Number(result.insertId);

  for (const p of players) {
    await db
      .insertInto('lan_players')
      .values({ lan_id: lanId, account_id: p.accountId })
      .execute();
  }

  // Kick off sync synchronously so the admin gets immediate feedback.
  // Inline is fine given the OpenDota throttle and small player counts.
  let syncResult = null;
  try {
    syncResult = await syncLan(lanId);
  } catch (e) {
    return NextResponse.json(
      { lanId, syncError: String(e?.message || e) },
      { status: 207 },
    );
  }

  revalidatePath(`/lan/${lanId}`, 'layout');
  revalidatePath('/');
  return NextResponse.json({ lanId, ...syncResult });
}
