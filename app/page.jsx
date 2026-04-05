import Link from 'next/link';
import { getDb } from '@/lib/db.js';
import { formatLanDateRange } from '@/lib/format.js';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = getDb();
  const lans = await db
    .selectFrom('lans')
    .leftJoin('lan_matches', 'lan_matches.lan_id', 'lans.id')
    .select(({ fn }) => [
      'lans.id',
      'lans.name',
      'lans.start_date',
      'lans.end_date',
      fn.count('lan_matches.match_id').as('match_count'),
    ])
    .groupBy(['lans.id', 'lans.name', 'lans.start_date', 'lans.end_date'])
    .orderBy('lans.start_date', 'desc')
    .execute();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">LANs</h1>
      {lans.length === 0 ? (
        <p className="text-muted-foreground">No LANs yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lans.map((l) => (
            <li key={l.id} className="rounded border p-4 hover:bg-accent">
              <Link href={`/lan/${l.id}`} className="block">
                <div className="text-lg font-medium">{l.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatLanDateRange(l.start_date, l.end_date)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {Number(l.match_count)} matches
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
