import { listJournalists } from "@/lib/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function JournalistsPage() {
  const rows = await listJournalists();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Journalists</h1>
        <p className="mt-1 text-sm text-muted">
          Bylines from <strong>verified digital PR</strong> stories only. Same
          name at the same outlet is grouped as one journalist; same name at
          different outlets is shown as separate rows. Sorted by story count.
          {rows.length === 0
            ? " No verified-PR articles with bylines yet — verify some on the queue first."
            : ""}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="bg-panel border border-rule overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead className="border-b border-rule">
              <tr className="text-left">
                <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                  Journalist
                </th>
                <th className="p-3 w-56 text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                  Outlet
                </th>
                <th className="p-3 w-24 text-[11px] font-sans font-medium uppercase tracking-label text-muted text-right">
                  Stories
                </th>
                <th className="p-3 w-32 text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                  Last seen
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = `/browse?verified=1&${new URLSearchParams({
                  byline: r.byline,
                  outlet: r.outlet,
                }).toString()}`;
                return (
                  <tr
                    key={`${r.outlet}|${r.byline}`}
                    className="border-t border-rule hover:bg-paper transition-colors"
                  >
                    <td className="p-3">
                      <Link
                        href={href}
                        className="font-sans font-medium hover:text-accent hover:underline"
                      >
                        {r.byline}
                      </Link>
                    </td>
                    <td className="p-3 truncate">{r.outlet}</td>
                    <td className="p-3 tabular-nums text-right">{r.storyCount}</td>
                    <td className="p-3 text-muted whitespace-nowrap">
                      {fmtDate(r.lastSeen)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
