import { getDb } from '@/lib/db.js';

/**
 * Image metadata for a LAN's gallery — deliberately excludes the BLOB columns
 * so the LAN page payload stays small. The actual bytes are served on demand
 * by /api/images/[imageId].
 */
export async function getLanImagesForLan(lanId) {
  const db = getDb();
  return db
    .selectFrom('lan_images')
    .select(['id', 'lan_id', 'filename', 'uploaded_at'])
    .where('lan_id', '=', lanId)
    .orderBy('id', 'asc')
    .execute();
}
