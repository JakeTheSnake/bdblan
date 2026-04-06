import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPlayerStats } from '@/lib/aggregations/playerStats.js';
import { formatDuration, formatMatchDate } from '@/lib/format.js';

export const dynamic = 'force-dynamic';

export default async function PlayerPage(props) {
  const params = await props.params;
  const lanId = Number(params.lanId);
  const accountId = Number(params.accountId);
  const data = await getPlayerStats(lanId, accountId);
  if (!data) notFound();

  const { player, totals, mostPlayedHero, netWorthAt10, matches } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/lan/${lanId}`} className="text-sm text-muted-foreground hover:underline">
          ← LAN summary
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{player.persona_name || player.account_id}</h1>
        <div className="text-sm text-muted-foreground">
          {totals.matches} matches · {totals.wins}W {totals.losses}L
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-muted-foreground">Most played hero</div>
          {mostPlayedHero ? (
            <div className="mt-2 flex items-center gap-3">
              {mostPlayedHero.hero_img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mostPlayedHero.hero_img} alt="" className="h-10 w-auto rounded" />
              ) : null}
              <div>
                <div className="font-medium">{mostPlayedHero.hero_name}</div>
                <div className="text-xs text-muted-foreground">{mostPlayedHero.count} games</div>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">-</div>
          )}
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-muted-foreground">K / D / A (totals)</div>
          <div className="mt-2 text-xl font-semibold">
            {totals.kills} / {totals.deaths} / {totals.assists}
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="text-xs uppercase text-muted-foreground">Net worth @ 10</div>
          {netWorthAt10 ? (
            <div className="mt-2 text-sm">
              avg <span className="font-semibold">{netWorthAt10.avg}</span>
              <span className="text-muted-foreground"> · min {netWorthAt10.min} · max {netWorthAt10.max}</span>
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">no data</div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Matches</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Hero</th>
                <th className="p-2">K/D/A</th>
                <th className="p-2">Duration</th>
                <th className="p-2">Match</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.match_id} className="border-t">
                  <td className="p-2 text-muted-foreground">{formatMatchDate(m.start_time)}</td>
                  <td className="p-2">{m.hero_name || m.hero_id}</td>
                  <td className="p-2">{m.kills}/{m.deaths}/{m.assists}</td>
                  <td className="p-2">{formatDuration(m.duration)}</td>
                  <td className="p-2">
                    <Link href={`/lan/${lanId}/matches/${m.match_id}`} className="hover:underline">
                      {m.match_id}
                    </Link>
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
