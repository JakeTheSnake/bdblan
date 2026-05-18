import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLanSummary } from '@/lib/aggregations/lanSummary.js';
import { getEzCountsForLan } from '@/lib/aggregations/ezCount.js';
import { getUniqueHeroCountsForLan } from '@/lib/aggregations/uniqueHeroes.js';
import { getKillParticipationForLan } from '@/lib/aggregations/killParticipation.js';
import { getHeroDamageForLan } from '@/lib/aggregations/heroDamage.js';
import { getTowerDamageForLan } from '@/lib/aggregations/towerDamage.js';
import { getHeroHealingForLan } from '@/lib/aggregations/heroHealing.js';
import { getSupportWardStatsForLan } from '@/lib/aggregations/supportWards.js';
import { getCourierKillsForLan } from '@/lib/aggregations/courierKills.js';
import { getObjectiveKillsForLan } from '@/lib/aggregations/objectiveKills.js';
import { getTeamfightDisadvantageForLan } from '@/lib/aggregations/teamfightAdvantage.js';
import { getLaneWinRatesForLan } from '@/lib/aggregations/laneWinRate.js';
import { getHighestNetWorthForLan } from '@/lib/aggregations/highestNetWorth.js';
import { getHighestDamageForLan } from '@/lib/aggregations/highestDamage.js';
import { getHighestDamageTakenForLan } from '@/lib/aggregations/highestDamageTaken.js';
import { getLanImagesForLan } from '@/lib/aggregations/lanImages.js';
import Highscore from '@/components/Highscore.jsx';
import LanImages from '@/components/LanImages.jsx';
import { formatDuration, formatLongDuration, formatPct, formatMatchDate, formatLanDateRange } from '@/lib/format.js';

export const revalidate = false;

export default async function LanSummaryPage(props) {
  const params = await props.params;
  const lanId = Number(params.lanId);
  const [data, ezCounts, uniqueHeroCounts, killParticipation, heroDamage, towerDamage, heroHealing, supportWards, courierKills, objectiveKills, laneWinRate, highestNetWorth, highestDamage, highestDamageTaken, lanImages, teamfightAdvantage] = await Promise.all([
    getLanSummary(lanId),
    getEzCountsForLan(lanId),
    getUniqueHeroCountsForLan(lanId),
    getKillParticipationForLan(lanId),
    getHeroDamageForLan(lanId),
    getTowerDamageForLan(lanId),
    getHeroHealingForLan(lanId),
    getSupportWardStatsForLan(lanId),
    getCourierKillsForLan(lanId),
    getObjectiveKillsForLan(lanId),
    getLaneWinRatesForLan(lanId),
    getHighestNetWorthForLan(lanId),
    getHighestDamageForLan(lanId),
    getHighestDamageTakenForLan(lanId),
    getLanImagesForLan(lanId),
    getTeamfightDisadvantageForLan(lanId),
  ]);
  if (!data) notFound();

  const { lan, players, totals, matches } = data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{lan.name}</h1>
        <div className="text-sm text-muted-foreground">
          {formatLanDateRange(lan.start_date, lan.end_date)}
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
        <StatCard label="Roshan kills" value={objectiveKills.roshanKills} />
        <StatCard label="Tormentor kills" value={objectiveKills.tormentorKills} />
        <StatCard label={'"ez" count'} value={ezCounts.total} />
        <StatCard
          label="Less heroes in teamfights (wins)"
          value={
            teamfightAdvantage.wins.fights > 0
              ? formatPct(teamfightAdvantage.wins.disadvantage / teamfightAdvantage.wins.fights)
              : '-'
          }
          sub={`${teamfightAdvantage.wins.disadvantage} of ${teamfightAdvantage.wins.fights} teamfights`}
        />
        <StatCard
          label="Less heroes in teamfights (losses)"
          value={
            teamfightAdvantage.losses.fights > 0
              ? formatPct(teamfightAdvantage.losses.disadvantage / teamfightAdvantage.losses.fights)
              : '-'
          }
          sub={`${teamfightAdvantage.losses.disadvantage} of ${teamfightAdvantage.losses.fights} teamfights`}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Highscores</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Highscore
            title="Unique heroes"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: uniqueHeroCounts.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Kill participation"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: killParticipation.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Hero damage"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: heroDamage.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Tower damage"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: towerDamage.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Hero healing"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: heroHealing.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Average wards placed (support games only)"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: supportWards.wardsPlaced.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Average dewards (support games only)"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: supportWards.dewards.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Courier kills"
            lanId={lanId}
            rows={players
              .map((p) => ({
                account_id: p.account_id,
                persona_name: p.persona_name,
                value: courierKills.get(Number(p.account_id)) || 0,
              }))
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Highest net worth in a game"
            lanId={lanId}
            rows={players
              .map((p) => {
                const best = highestNetWorth.get(Number(p.account_id));
                return {
                  account_id: p.account_id,
                  persona_name: p.persona_name,
                  value: best ? best.value : 0,
                  hero_id: best ? best.hero_id : undefined,
                  hero_icon: best ? best.hero_icon : undefined,
                  match_id: best ? best.match_id : undefined,
                };
              })
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Highest damage in a game"
            lanId={lanId}
            rows={players
              .map((p) => {
                const best = highestDamage.get(Number(p.account_id));
                return {
                  account_id: p.account_id,
                  persona_name: p.persona_name,
                  value: best ? best.value : 0,
                  hero_id: best ? best.hero_id : undefined,
                  hero_icon: best ? best.hero_icon : undefined,
                  match_id: best ? best.match_id : undefined,
                };
              })
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Highest damage taken in a game"
            lanId={lanId}
            rows={players
              .map((p) => {
                const best = highestDamageTaken.get(Number(p.account_id));
                return {
                  account_id: p.account_id,
                  persona_name: p.persona_name,
                  value: best ? best.value : 0,
                  hero_id: best ? best.hero_id : undefined,
                  hero_icon: best ? best.hero_icon : undefined,
                  match_id: best ? best.match_id : undefined,
                };
              })
              .sort((a, b) => b.value - a.value)}
          />
          <Highscore
            title="Lane win rate (ties excluded)"
            lanId={lanId}
            rows={players
              .map((p) => {
                const r = laneWinRate.get(Number(p.account_id));
                return {
                  account_id: p.account_id,
                  persona_name: p.persona_name,
                  rate: r && r.total > 0 ? r.rate : -1,
                  value: r && r.total > 0 ? `${Math.round(r.rate * 100)}%` : '-',
                };
              })
              .sort((a, b) => b.rate - a.rate)}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Images</h2>
        <LanImages lanId={lanId} images={lanImages} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Matches</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
