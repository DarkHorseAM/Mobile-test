import {
  topBrands,
  topOutlets,
  topPatterns,
  patternCountsForRange,
  headlineWordFrequencies,
} from "@/lib/db/trends";
import { Badge, Card } from "@/components/ui/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export default async function TrendsPage() {
  const now = new Date();
  const sevenDays = daysAgo(7);
  const fourteenDays = daysAgo(14);

  const [brands, outlets, pats, thisWeek, lastWeek, words] = await Promise.all([
    topBrands(sevenDays),
    topOutlets(sevenDays),
    topPatterns(sevenDays),
    patternCountsForRange(sevenDays, now),
    patternCountsForRange(fourteenDays, sevenDays),
    headlineWordFrequencies(sevenDays),
  ]);

  const lastWeekMap = new Map(lastWeek.map((r) => [r.slug, r.count]));
  const deltas = thisWeek
    .map((r) => ({
      label: r.label,
      thisWeek: r.count,
      lastWeek: lastWeekMap.get(r.slug) ?? 0,
      delta: r.count - (lastWeekMap.get(r.slug) ?? 0),
    }))
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 12);

  const maxWord = words[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trends (last 7 days)</h1>
        <p className="text-sm text-muted-foreground">
          Where PR is landing right now. Click anything to filter the Browse view.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <h2 className="font-semibold mb-3">Top brands</h2>
          <ol className="space-y-1.5 text-sm">
            {brands.length === 0 && <li className="text-muted-foreground">No brand attributions yet.</li>}
            {brands.map((b) => (
              <li key={b.brand} className="flex items-center justify-between gap-2">
                <Link
                  className="hover:underline truncate"
                  href={`/browse?brand=${encodeURIComponent(b.brand ?? "")}`}
                >
                  {b.brand}
                </Link>
                <span className="text-muted-foreground">{b.count}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Top patterns</h2>
          <ol className="space-y-1.5 text-sm">
            {pats.length === 0 && <li className="text-muted-foreground">No matches yet.</li>}
            {pats.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-2">
                <Link
                  className="hover:underline truncate"
                  href={`/browse?pattern=${encodeURIComponent(p.slug)}`}
                >
                  {p.label}
                </Link>
                <span className="text-muted-foreground">{p.count}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Top outlets</h2>
          <ol className="space-y-1.5 text-sm">
            {outlets.length === 0 && <li className="text-muted-foreground">No coverage yet.</li>}
            {outlets.map((o) => (
              <li key={o.outlet} className="flex items-center justify-between gap-2">
                <Link
                  className="hover:underline truncate"
                  href={`/browse?outlet=${encodeURIComponent(o.outlet)}`}
                >
                  {o.outlet}
                </Link>
                <span className="text-muted-foreground">{o.count}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold mb-3">This week vs last week</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Pattern</th>
              <th className="py-1 w-20 text-right">This wk</th>
              <th className="py-1 w-20 text-right">Last wk</th>
              <th className="py-1 w-20 text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {deltas.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  Not enough data yet.
                </td>
              </tr>
            )}
            {deltas.map((d) => (
              <tr key={d.label} className="border-t">
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right">{d.thisWeek}</td>
                <td className="py-1.5 text-right text-muted-foreground">{d.lastWeek}</td>
                <td
                  className={
                    "py-1.5 text-right font-medium " +
                    (d.delta > 0 ? "text-green-700" : d.delta < 0 ? "text-red-700" : "text-muted-foreground")
                  }
                >
                  {d.delta > 0 ? "+" : ""}
                  {d.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3">Headline word frequencies</h2>
        {words.length === 0 ? (
          <p className="text-sm text-muted-foreground">No headlines indexed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 items-baseline">
            {words.map((w) => (
              <span
                key={w.word}
                style={{ fontSize: `${0.75 + (w.count / maxWord) * 1.25}rem` }}
                className="text-slate-700"
              >
                {w.word}
                <span className="text-xs text-muted-foreground ml-0.5">·{w.count}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="text-xs text-muted-foreground">
        <Badge>Note</Badge> Trends use article publication date when present. Articles without a published date are excluded.
      </div>
    </div>
  );
}
