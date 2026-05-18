import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db.js';

const MAX_BYTES = 15 * 1024 * 1024; // MEDIUMBLOB is 16 MB; leave headroom.

// POST /api/admin/lans/[id]/images
// multipart/form-data: image (Blob), thumb (Blob), filename (string).
// The client re-encodes both as WebP, so the server just stores them verbatim.
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

  // Everything below can throw on a malformed body or a DB error (e.g. a blob
  // exceeding MySQL's max_allowed_packet). Catch it so the client gets a real
  // message instead of a non-JSON 500 surfacing as a generic "upload failed".
  try {
    const form = await req.formData();
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
    const rawName = form.get('filename');
    const filename = typeof rawName === 'string' ? rawName.slice(0, 255) : null;

    const result = await db
      .insertInto('lan_images')
      .values({
        lan_id: lanId,
        filename,
        mime_type: image.type,
        image_data: imageBuf,
        thumb_mime: thumb.type,
        thumb_data: thumbBuf,
      })
      .executeTakeFirstOrThrow();

    revalidatePath(`/lan/${lanId}`, 'layout');
    return NextResponse.json({ id: Number(result.insertId) });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
