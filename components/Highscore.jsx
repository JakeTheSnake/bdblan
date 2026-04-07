import Link from 'next/link';

/**
 * Reusable highscore table for the LAN summary page.
 *
 * @param {{ title: string, lanId: number, rows: { account_id: number, persona_name: string, value: number|string }[] }} props
 */
export default function Highscore({ title, lanId, rows }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      <div className="overflow-x-auto rounded border">
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
                  <Link href={`/lan/${lanId}/players/${r.account_id}`} className="hover:underline">
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
