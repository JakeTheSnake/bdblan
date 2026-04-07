import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db.js';

// DELETE /api/admin/lans/[id]
// Removes the LAN and everything that was exclusively attached to it.
//
// Cascade behavior (already wired in the schema):
//   lans            → lan_players, lan_matches via ON DELETE CASCADE
//   matches         → match_players, match_objectives via ON DELETE CASCADE
//
// Matches can belong to multiple LANs (overlapping player sets), so we only
// delete a match row if no other LAN still references it after this LAN's
// lan_matches links are gone. Player rows are left alone — they're small,
// and match_players.account_id has no FK so deleting players would strand
// references.
export async function DELETE(_req, props) {
  const params = await props.params;
  const lanId = Number(params.id);
  if (!lanId) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const db = getDb();

  const lan = await db
    .selectFrom('lans')
    .select('id')
    .where('id', '=', lanId)
    .executeTakeFirst();
  if (!lan) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const linked = await db
    .selectFrom('lan_matches')
    .select('match_id')
    .where('lan_id', '=', lanId)
    .execute();
  const linkedMatchIds = linked.map((r) => r.match_id);

  let orphanedMatches = 0;
  await db.transaction().execute(async (trx) => {
    // Cascades lan_players and lan_matches.
    await trx.deleteFrom('lans').where('id', '=', lanId).execute();

    if (linkedMatchIds.length > 0) {
      const stillReferenced = await trx
        .selectFrom('lan_matches')
        .select('match_id')
        .where('match_id', 'in', linkedMatchIds)
        .execute();
      const refSet = new Set(stillReferenced.map((r) => String(r.match_id)));
      const orphans = linkedMatchIds.filter((id) => !refSet.has(String(id)));
      if (orphans.length > 0) {
        await trx.deleteFrom('matches').where('match_id', 'in', orphans).execute();
        orphanedMatches = orphans.length;
      }
    }
  });

  revalidatePath(`/lan/${lanId}`, 'layout');
  revalidatePath('/');
  return NextResponse.json({ ok: true, deletedMatches: orphanedMatches });
}
