import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLanSummary } from '@/lib/aggregations/lanSummary.js';
import { getSession } from '@/lib/auth.js';
import DeleteLanButton from '@/components/DeleteLanButton.jsx';
import { formatDuration, formatLongDuration, formatPct, formatMatchDate, formatLanDateRange } from '@/lib/format.js';

export const dynamic = 'force-dynamic';

export default async function LanSummaryPage({ params }) {
  const lanId = Number(params.lanId);
  const data = await getLanSummary(lanId);
  if (!data) notFound();

  const { lan, players, totals, matches } = data;
  const session = await getSession();
  const isAdmin = !!session;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{lan.name}</h1>
            <div className="text-sm text-muted-foreground">
              {formatLanDateRange(lan.start_date, lan.end_date)}
            </div>
          </div>
          {isAdmin ? <DeleteLanButton lanId={lan.id} lanName={lan.name} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {players.map((p) => (
            <Link
              key={p.account_id}
              href={`/lan/${lanId}/players/${p.account_id}`}
              className={
                'rounded-full border px-3 py-1 text-sm hover:bg-accent ' +
                (Number(p.account_id) === Number(lan.host_account_id)
                  ? 'border-primary font-medium'
                  : '')
              }
            >
              {p.persona_name || p.account_id}
              {Number(p.account_id) === Number(lan.host_account_id) ? ' ★' : ''}
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Matches" value={totals.matches} />
        <StatCard
          label="Wins / Losses"
          value={`${totals.wins} / ${totals.losses}`}
          sub={`${formatPct(totals.winrate)} winrate`}
        />
        <StatCard label="Total game time" value={formatLongDuration(totals.totalDurationSec)} />
        <StatCard label="Average game time" value={formatDuration(totals.avgDurationSec)} />
        <StatCard
          label="Fastest win"
          value={totals.fastestWin ? formatDuration(totals.fastestWin.duration) : '-'}
        />
        <StatCard
          label="Fastest loss"
          value={totals.fastestLoss ? formatDuration(totals.fastestLoss.duration) : '-'}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Matches</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Match ID</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.match_id} className="border-t">
                  <td className="p-2 text-muted-foreground">{formatMatchDate(m.start_time)}</td>
                  <td className="p-2">
                    <Link href={`/lan/${lanId}/matches/${m.match_id}`} className="hover:underline">
                      {m.match_id}
                    </Link>
                  </td>
                  <td className="p-2">{formatDuration(m.duration)}</td>
                  <td className={'p-2 font-medium ' + (m.won ? 'text-team-us' : 'text-team-them')}>
                    {m.won ? 'Win' : 'Loss'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded border p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
