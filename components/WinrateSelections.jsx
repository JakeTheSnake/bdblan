import { selectionWinrate, predicates as P } from '@/lib/aggregations/winrateSelections.js';
import { formatPct } from '@/lib/format.js';

/**
 * Selections rendered by the table: description -> a fetch-function that
 * resolves to our winrate ({ wins, losses, total, winrate }) over the LAN
 * matches matching that selection.
 *
 * To add a row, append one `[description, (lanId) => selectionWinrate(...)]`
 * entry — see lib/aggregations/winrateSelections.js for available predicates.
 */
const SELECTIONS = new Map([
  ['Their tier-1 safe lane tower falls before ours', (id) => selectionWinrate(id, P.enemyTier1TowerFallsFirst('safe'))],
  ['Their tier-1 mid tower falls before ours', (id) => selectionWinrate(id, P.enemyTier1TowerFallsFirst('mid'))],
  ['Their tier-1 off lane tower falls before ours', (id) => selectionWinrate(id, P.enemyTier1TowerFallsFirst('off'))],
  ['We destroy the first tier-1 tower', (id) => selectionWinrate(id, P.weDestroyFirstTier1Tower)],
  ['We kill tormentor before opponents', (id) => selectionWinrate(id, P.weKillTormentorFirst)],
  ['We draw first blood', (id) => selectionWinrate(id, P.weDrawFirstBlood)],
  ['We win 0 lanes', (id) => selectionWinrate(id, P.weWinExactlyNLanes(0))],
  ['We win 1 lane', (id) => selectionWinrate(id, P.weWinExactlyNLanes(1))],
  ['We win 2 lanes', (id) => selectionWinrate(id, P.weWinExactlyNLanes(2))],
  ['We win all 3 lanes', (id) => selectionWinrate(id, P.weWinExactlyNLanes(3))],
  ['We win safe lane', (id) => selectionWinrate(id, P.weWinLane('safe'))],
  ['We win mid lane', (id) => selectionWinrate(id, P.weWinLane('mid'))],
  ['We win off lane', (id) => selectionWinrate(id, P.weWinLane('off'))],
]);

/**
 * Two-column table of our winrate under a range of game selections. Each
 * winrate is tinted green/red relative to the LAN's overall winrate.
 * @param {{ lanId: number, totalWinrate: number }} props
 */
export default async function WinrateSelections({ lanId, totalWinrate }) {
  const entries = [...SELECTIONS];
  const results = await Promise.all(entries.map(([, fn]) => fn(lanId)));

  return (
    <div className="inline-block max-w-full overflow-x-auto rounded-lg border border-border bg-card">
      <table className="text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-right">Selection</th>
            <th className="p-2 text-left">Winrate</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([desc], i) => {
            const r = results[i];
            const color =
              r.total === 0 || r.winrate === totalWinrate
                ? ''
                : r.winrate > totalWinrate
                  ? 'text-team-us'
                  : 'text-team-them';
            return (
              <tr key={desc} className="border-t">
                <td className="p-2 text-right whitespace-nowrap">{desc}</td>
                <td className="p-2 text-left font-medium whitespace-nowrap">
                  {r.total > 0 ? (
                    <>
                      <span className={color}>{formatPct(r.winrate)}</span>{' '}
                      <span className="text-muted-foreground">
                        ({r.wins}/{r.total})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">— (0/0)</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
