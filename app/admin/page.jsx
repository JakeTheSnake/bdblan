import Link from 'next/link';
import { getDb } from '@/lib/db.js';
import { formatLanDateRange } from '@/lib/format.js';
import DeleteLanButton from '@/components/DeleteLanButton.jsx';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const db = getDb();
  const lans = await db
    .selectFrom('lans')
    .selectAll()
    .orderBy('start_date', 'desc')
    .execute();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex gap-2">
          <form action="/api/admin/heroes/sync" method="post">
            <button className="rounded border border-input px-3 py-1.5 text-sm">
              Sync heroes
            </button>
          </form>
          <Link
            href="/admin/lans/new"
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            New LAN
          </Link>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">LANs</h2>
        {lans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No LANs yet. Create one to get started.</p>
        ) : (
          <ul className="divide-y rounded border">
            {lans.map((l) => (
              <li key={l.id} className="flex items-center justify-between p-3">
                <div>
                  <Link href={`/lan/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {formatLanDateRange(l.start_date, l.end_date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <form action={`/api/admin/lans/${l.id}/sync`} method="post">
                    <button className="rounded border border-input px-2 py-1 text-xs">
                      Re-sync
                    </button>
                  </form>
                  <DeleteLanButton lanId={l.id} lanName={l.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
