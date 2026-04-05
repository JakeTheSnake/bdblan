import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMatchDetails } from '@/lib/aggregations/matchDetails.js';
import { formatDuration, formatMatchDate } from '@/lib/format.js';

export const dynamic = 'force-dynamic';

export default async function MatchPage({ params }) {
  const lanId = Number(params.lanId);
  const data = await getMatchDetails(lanId, params.matchId);
  if (!data) notFound();

  const { match, weWon, usPlayers, themPlayers, towers, roshans, tormentors } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/lan/${lanId}`} className="text-sm text-muted-foreground hover:underline">
          ← LAN summary
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Match {String(match.match_id)}{' '}
          <span className={weWon ? 'text-team-us' : 'text-team-them'}>
            — {weWon ? 'Win' : 'Loss'}
          </span>
        </h1>
        <div className="text-sm text-muted-foreground">
          {formatMatchDate(match.start_time)} · {formatDuration(match.duration)}
        </div>
      </div>

      <section className="space-y-3">
        <TeamRow label="Our team" color="us" players={usPlayers} />
        <TeamRow label="Enemy" color="them" players={themPlayers} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Timeline title="Towers" events={towers} renderExtra={(e) => e.key?.replace('npc_dota_', '')} />
        <Timeline title="Roshan" events={roshans} />
        <Timeline title="Tormentor" events={tormentors} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Net worth @ 10 min</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <NwTable label="Us" color="us" players={usPlayers} />
          <NwTable label="Them" color="them" players={themPlayers} />
        </div>
      </section>
    </div>
  );
}

function TeamRow({ label, color, players }) {
  const border = color === 'us' ? 'border-team-us' : 'border-team-them';
  return (
    <div className={`rounded border-2 ${border} p-3`}>
      <div className="mb-2 text-xs uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-3">
        {players.map((p) => (
          <div key={p.player_slot} className="flex items-center gap-2">
            {p.hero_img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.hero_img} alt="" className="h-10 w-auto rounded" />
            ) : (
              <div className="h-10 w-16 rounded bg-muted" />
            )}
            <div className="text-xs">
              <div className="font-medium">{p.hero_name || p.hero_id}</div>
              <div className="text-muted-foreground">
                {p.persona_name || (p.is_lan_player ? p.account_id : 'opponent')}
              </div>
              <div>
                {p.kills}/{p.deaths}/{p.assists}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline({ title, events, renderExtra }) {
  return (
    <div className="rounded border p-3">
      <div className="mb-2 text-sm font-medium">{title}</div>
      {events.length === 0 ? (
        <div className="text-xs text-muted-foreground">none</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {events.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="tabular-nums">{formatDuration(e.time)}</span>
              <span className={e.is_us ? 'text-team-us' : 'text-team-them'}>
                {e.is_us ? 'us' : 'them'}
              </span>
              {renderExtra ? (
                <span className="truncate text-xs text-muted-foreground">{renderExtra(e)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NwTable({ label, color, players }) {
  const cls = color === 'us' ? 'text-team-us' : 'text-team-them';
  return (
    <div className="rounded border p-3">
      <div className={`mb-2 text-xs uppercase ${cls}`}>{label}</div>
      <table className="w-full text-sm">
        <tbody>
          {players.map((p) => (
            <tr key={p.player_slot} className="border-t first:border-0">
              <td className="py-1">{p.hero_name || p.hero_id}</td>
              <td className="py-1 text-right tabular-nums">
                {p.net_worth_at_10 != null ? p.net_worth_at_10 : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
