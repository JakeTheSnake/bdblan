import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db.js';

const MAX_BYTES = 15 * 1024 * 1024; // MEDIUMBLOB is 16 MB; leave headroom.

// POST /api/admin/lans/[id]/images
// multipart/form-data: image (File), thumb (Blob), filename (string).
// The thumbnail is generated client-side so the server stores both verbatim.
export async function POST(req, props) {
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

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const image = form.get('image');
  const thumb = form.get('thumb');
  if (!image || typeof image === 'string' || !thumb || typeof thumb === 'string') {
    return NextResponse.json({ error: 'missing image or thumb' }, { status: 400 });
  }
  if (!image.type.startsWith('image/') || !thumb.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not an image' }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'image too large' }, { status: 413 });
  }

  const imageBuf = Buffer.from(await image.arrayBuffer());
  const thumbBuf = Buffer.from(await thumb.arrayBuffer());
  const filename = typeof form.get('filename') === 'string' ? form.get('filename') : null;

  const result = await db
    .insertInto('lan_images')
    .values({
      lan_id: lanId,
      filename: filename ? String(filename).slice(0, 255) : null,
      mime_type: image.type,
      image_data: imageBuf,
      thumb_mime: thumb.type,
      thumb_data: thumbBuf,
    })
    .executeTakeFirstOrThrow();

  revalidatePath(`/lan/${lanId}`, 'layout');
  return NextResponse.json({ id: Number(result.insertId) });
}
