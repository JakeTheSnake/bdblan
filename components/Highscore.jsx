import Link from 'next/link';

/**
 * Reusable highscore table for the LAN summary page.
 *
 * Each row may optionally carry `hero_id`, `hero_icon` (URL) and `match_id`:
 * when `hero_icon` is present the hero's icon is shown before the player's
 * name, linking to `match_id` — used by highscores tied to a single game
 * (e.g. highest net worth).
 *
 * @param {{ title: string, lanId: number, rows: { account_id: number, persona_name: string, value: number|string, hero_id?: number, hero_icon?: string|null, match_id?: number }[] }} props
 */
export default function Highscore({ title, lanId, rows }) {
  return (
    <div>
      <h3 className="mb-2 text-primary font-medium">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2 w-8">#</th>
              <th className="p-2">Player</th>
              <th className="p-2 text-right">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.account_id} className="border-t">
                <td className="p-2 text-muted-foreground">{i + 1}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {r.hero_icon ? (
                      <Link
                        href={`/lan/${lanId}/matches/${r.match_id}`}
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.hero_icon} alt="" className="h-6 w-6" />
                      </Link>
                    ) : null}
                    <Link
                      href={`/lan/${lanId}/players/${r.account_id}`}
                      className="hover:underline"
                    >
                      {r.persona_name || r.account_id}
                    </Link>
                  </div>
                </td>
                <td className="p-2 text-right font-medium">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
