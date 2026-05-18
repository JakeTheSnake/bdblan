import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db.js';

// DELETE /api/admin/lans/[id]/images/[imageId]
export async function DELETE(_req, props) {
  const params = await props.params;
  const lanId = Number(params.id);
  const imageId = Number(params.imageId);
  if (!lanId || !imageId) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  const db = getDb();
  const result = await db
    .deleteFrom('lan_images')
    .where('id', '=', imageId)
    .where('lan_id', '=', lanId)
    .executeTakeFirst();

  if (!Number(result.numDeletedRows)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  revalidatePath(`/lan/${lanId}`, 'layout');
  return NextResponse.json({ ok: true });
}
