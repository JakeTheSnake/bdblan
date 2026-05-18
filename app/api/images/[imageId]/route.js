import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db.js';

// GET /api/images/[imageId]            -> full image
// GET /api/images/[imageId]?thumb=1    -> thumbnail
// Public: image bytes are not sensitive and the LAN pages are statically
// rendered, so this is the only per-request work needed to show the gallery.
export async function GET(req, props) {
  const params = await props.params;
  const imageId = Number(params.imageId);
  if (!imageId) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const thumb = new URL(req.url).searchParams.get('thumb');

  const db = getDb();
  const row = await db
    .selectFrom('lan_images')
    .select(['image_data', 'mime_type', 'thumb_data', 'thumb_mime'])
    .where('id', '=', imageId)
    .executeTakeFirst();
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const data = thumb ? row.thumb_data : row.image_data;
  const mime = thumb ? row.thumb_mime : row.mime_type;

  return new Response(data, {
    headers: {
      'Content-Type': mime,
      // A given id always returns the same bytes — safe to cache forever.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
