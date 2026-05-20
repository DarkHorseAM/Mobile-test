import { db } from "@/lib/db/client";
import { scanRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

type ParsedError = { feed: string; message: string };

function parseErrors(raw: string | null): ParsedError[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatStarted(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

function formatDuration(started: Date, finished: Date | null): string {
  if (!finished) return "running…";
  const ms = finished.getTime() - started.getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m${secs.toString().padStart(2, "0")}s`;
}

export default async function ScansAdminPage() {
  const rows = await db
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.startedAt))
    .limit(30);

  // Roll up which feeds have failed across the visible window, to make
  // chronic-failure patterns easy to spot.
  const failureCounts = new Map<string, { count: number; lastMessage: string }>();
  for (const r of rows) {
    for (const e of parseErrors(r.error)) {
      const prev = failureCounts.get(e.feed);
      failureCounts.set(e.feed, {
        count: (prev?.count ?? 0) + 1,
        lastMessage: e.message,
      });
    }
  }
  const failureSummary = [...failureCounts.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Scan history</h1>
        <p className="mt-1 text-sm text-muted">
          Last 30 scan runs. Each row shows duration, feeds reached, articles
          ingested, and per-feed errors. Use this to spot chronically-failing
          feeds (e.g. publishers that started 403&apos;ing).
        </p>
      </div>

      {failureSummary.length > 0 && (
        <div className="bg-panel border border-rule overflow-hidden">
          <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
            Failing feeds across the last {rows.length} runs
          </div>
          <ul className="divide-y divide-rule">
            {failureSummary.map(([feed, info]) => (
              <li key={feed} className="px-5 py-2 text-sm flex items-baseline justify-between gap-4">
                <span className="font-sans font-medium">{feed}</span>
                <span className="flex items-baseline gap-3 text-xs">
                  <span className="text-muted">{info.lastMessage}</span>
                  <span className="tabular-nums text-accent font-sans font-medium uppercase tracking-label text-[10px]">
                    {info.count}/{rows.length}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-panel border border-rule overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="border-b border-rule">
            <tr className="text-left">
              <th className="p-3 w-44 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Started</th>
              <th className="p-3 w-20 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Took</th>
              <th className="p-3 w-16 text-[11px] font-sans font-medium uppercase tracking-label text-muted text-right">Feeds</th>
              <th className="p-3 w-16 text-[11px] font-sans font-medium uppercase tracking-label text-muted text-right">Seen</th>
              <th className="p-3 w-16 text-[11px] font-sans font-medium uppercase tracking-label text-muted text-right">New</th>
              <th className="p-3 w-20 text-[11px] font-sans font-medium uppercase tracking-label text-muted text-right">Matches</th>
              <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-8 text-center text-muted" colSpan={7}>
                  <span className="font-display text-xl text-ink">no scans yet</span>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const errors = parseErrors(r.error);
              return (
                <tr key={r.id} className="border-t border-rule align-top">
                  <td className="p-3 text-muted whitespace-nowrap">
                    {formatStarted(r.startedAt)}
                  </td>
                  <td className="p-3 text-muted tabular-nums">
                    {formatDuration(r.startedAt, r.finishedAt)}
                  </td>
                  <td className="p-3 tabular-nums text-right">{r.feedsScanned}</td>
                  <td className="p-3 tabular-nums text-right">{r.articlesSeen}</td>
                  <td className="p-3 tabular-nums text-right">{r.articlesNew}</td>
                  <td className="p-3 tabular-nums text-right">{r.matchesNew}</td>
                  <td className="p-3">
                    {errors.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-accent hover:underline text-[11px] font-sans font-medium uppercase tracking-label">
                          {errors.length} error{errors.length === 1 ? "" : "s"}
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {errors.map((e, i) => (
                            <li key={i}>
                              <span className="font-sans font-medium uppercase tracking-label text-[10px] text-ink">
                                {e.feed}:
                              </span>{" "}
                              <span className="text-muted">{e.message}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
