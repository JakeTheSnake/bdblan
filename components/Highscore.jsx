import Link from 'next/link';

/**
 * Reusable highscore table for the LAN summary page.
 *
 * Each row may optionally carry a `hero_id` and `hero_icon` (URL): when
 * `hero_icon` is present the hero's icon is shown before the player's name —
 * used by highscores tied to a single game (e.g. highest net worth).
 *
 * @param {{ title: string, lanId: number, rows: { account_id: number, persona_name: string, value: number|string, hero_id?: number, hero_icon?: string|null }[] }} props
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
                  <Link
                    href={`/lan/${lanId}/players/${r.account_id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {r.hero_icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.hero_icon} alt="" className="h-6 w-6 shrink-0" />
                    ) : null}
                    {r.persona_name || r.account_id}
                  </Link>
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
