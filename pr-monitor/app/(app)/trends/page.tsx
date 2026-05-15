import {
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

  const [outlets, pats, thisWeek, lastWeek, words] = await Promise.all([
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
    <div className="space-y-8">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Trends</h1>
        <p className="mt-1 text-sm text-muted">
          Last 7 days — where PR is landing right now. Click anything to filter the Browse view.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mb-3">
            Top patterns
          </h2>
          <ol className="space-y-1.5 text-sm">
            {pats.length === 0 && (
              <li className="text-muted font-display text-lg">no matches yet</li>
            )}
            {pats.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-2">
                <Link
                  className="hover:text-accent hover:underline truncate"
                  href={`/browse?pattern=${encodeURIComponent(p.slug)}`}
                >
                  {p.label}
                </Link>
                <span className="text-muted tabular-nums">{p.count}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mb-3">
            Top outlets
          </h2>
          <ol className="space-y-1.5 text-sm">
            {outlets.length === 0 && (
              <li className="text-muted font-display text-lg">no coverage yet</li>
            )}
            {outlets.map((o) => (
              <li key={o.outlet} className="flex items-center justify-between gap-2">
                <Link
                  className="hover:text-accent hover:underline truncate"
                  href={`/browse?outlet=${encodeURIComponent(o.outlet)}`}
                >
                  {o.outlet}
                </Link>
                <span className="text-muted tabular-nums">{o.count}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mb-3">
          This week vs last week
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-1 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Pattern</th>
              <th className="py-1 w-20 text-right text-[11px] font-sans font-medium uppercase tracking-label text-muted">This wk</th>
              <th className="py-1 w-20 text-right text-[11px] font-sans font-medium uppercase tracking-label text-muted">Last wk</th>
              <th className="py-1 w-20 text-right text-[11px] font-sans font-medium uppercase tracking-label text-muted">Δ</th>
            </tr>
          </thead>
          <tbody>
            {deltas.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  <span className="font-display text-xl text-ink">not enough data yet</span>
                </td>
              </tr>
            )}
            {deltas.map((d) => (
              <tr key={d.label} className="border-t border-rule">
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right tabular-nums">{d.thisWeek}</td>
                <td className="py-1.5 text-right text-muted tabular-nums">{d.lastWeek}</td>
                <td
                  className={
                    "py-1.5 text-right font-sans font-medium tabular-nums " +
                    (d.delta > 0 ? "text-accent" : d.delta < 0 ? "text-muted" : "text-muted")
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
        <h2 className="text-[11px] font-sans font-medium uppercase tracking-label text-muted mb-3">
          Headline word frequencies
        </h2>
        {words.length === 0 ? (
          <p className="text-sm text-muted">
            <span className="font-display text-lg text-ink">no headlines yet</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 items-baseline">
            {words.map((w) => (
              <span
                key={w.word}
                style={{ fontSize: `${0.75 + (w.count / maxWord) * 1.25}rem` }}
                className="text-ink"
              >
                {w.word}
                <span className="text-xs text-muted ml-0.5">·{w.count}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="text-xs text-muted">
        <Badge>Note</Badge>{" "}
        <span className="ml-2">
          Trends use article publication date when present. Articles without a published date are excluded.
        </span>
      </div>
    </div>
  );
}
