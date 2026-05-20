import { db } from "@/lib/db/client";
import { feeds } from "@/lib/db/schema";
import { FEED_CANDIDATES } from "@/lib/db/feed-candidates";
import { fetchFeed } from "@/lib/scanner/fetch";
import { Button, Card } from "@/components/ui/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ProbeResult = {
  name: string;
  url: string;
  tier: string;
  ok: boolean;
  itemCount: number;
  firstHeadline: string | null;
  error: string | null;
  alreadyInDb: boolean;
};

// In-memory cache of last probe results, for the page render only. On
// Vercel this lives in one Lambda instance and won't reliably survive
// across requests — but it's fine as a "best effort" so the same warm
// Lambda doesn't re-probe on every reload. The apply action does NOT
// depend on this; it re-probes from scratch.
const STORE: { probed: ProbeResult[] | null } = { probed: null };

async function probeAll(): Promise<ProbeResult[]> {
  const existingUrls = new Set(
    (
      await db
        .select({ url: feeds.url })
        .from(feeds)
        .where(
          inArray(
            feeds.url,
            FEED_CANDIDATES.map((c) => c.url),
          ),
        )
    ).map((r) => r.url),
  );

  const results = await Promise.allSettled(
    FEED_CANDIDATES.map(async (c) => {
      const items = await fetchFeed(c.url);
      return { items, candidate: c };
    }),
  );

  return results.map((r, i) => {
    const c = FEED_CANDIDATES[i];
    const alreadyInDb = existingUrls.has(c.url);
    if (r.status === "rejected") {
      return {
        name: c.name,
        url: c.url,
        tier: c.tier,
        ok: false,
        itemCount: 0,
        firstHeadline: null,
        error: (r.reason as Error).message.slice(0, 300),
        alreadyInDb,
      };
    }
    const { items } = r.value;
    return {
      name: c.name,
      url: c.url,
      tier: c.tier,
      ok: items.length > 0,
      itemCount: items.length,
      firstHeadline: items[0]?.headline ?? null,
      error: items.length === 0 ? "Feed parsed but returned 0 items" : null,
      alreadyInDb,
    };
  });
}

async function probe() {
  "use server";
  STORE.probed = await probeAll();
  revalidatePath("/admin/feeds-import");
  redirect("/admin/feeds-import");
}

async function apply() {
  "use server";
  // Always re-probe so Apply doesn't depend on STORE surviving a cold
  // Lambda boundary. Slower (~30s) but reliable.
  const probed = await probeAll();
  STORE.probed = probed;

  const toInsert = probed.filter((r) => r.ok && !r.alreadyInDb);
  let insertedCount = 0;
  for (const r of toInsert) {
    const ins = await db
      .insert(feeds)
      .values({ name: r.name, url: r.url, tier: r.tier })
      .onConflictDoNothing({ target: feeds.url })
      .returning({ id: feeds.id });
    if (ins.length > 0) insertedCount += 1;
  }
  revalidatePath("/admin/feeds-import");
  revalidatePath("/config/feeds");
  redirect(`/admin/feeds-import?applied=${insertedCount}`);
}

export default async function FeedsImportPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string }>;
}) {
  const { applied: appliedRaw } = await searchParams;
  const appliedCount =
    appliedRaw && /^\d+$/.test(appliedRaw) ? Number(appliedRaw) : null;

  const probed = STORE.probed;
  const okCount = probed?.filter((r) => r.ok).length ?? 0;
  const failCount = probed?.filter((r) => !r.ok).length ?? 0;
  const newCount = probed?.filter((r) => r.ok && !r.alreadyInDb).length ?? 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Import Candidate Feeds</h1>
        <p className="mt-1 text-sm text-muted">
          Probes the {FEED_CANDIDATES.length} candidate URLs in{" "}
          <code className="text-xs">lib/db/feed-candidates.ts</code> and
          reports which return parseable RSS. Nothing is written to the
          database until you click <strong>Add to database</strong> below the
          results table.
        </p>
      </div>

      {appliedCount !== null && (
        <div className="bg-panel border border-rule p-4 text-sm">
          <span className="text-[11px] font-sans font-medium uppercase tracking-label text-ink mr-2">
            Applied
          </span>
          Inserted {appliedCount} new feed{appliedCount === 1 ? "" : "s"} into
          the database. Re-probe to verify they show as <strong>DUP</strong>.
          {appliedCount === 0 && " (Either everything was already in the DB, or the live probe found no working URLs.)"}
        </div>
      )}

      <Card>
        <form action={probe}>
          <Button type="submit">
            {probed ? "Re-probe candidates" : "Probe candidates"}
          </Button>
        </form>
      </Card>

      {probed && (
        <>
          <div className="bg-panel border border-rule overflow-hidden">
            <div className="px-5 py-3 border-b border-rule text-xs font-sans font-medium uppercase tracking-label text-muted">
              {okCount} ok · {failCount} failed · {newCount} new to insert
            </div>
            <table className="w-full text-sm font-mono">
              <thead className="border-b border-rule">
                <tr className="text-left">
                  <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Outlet</th>
                  <th className="p-3 w-20 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Items</th>
                  <th className="p-3 w-24 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Status</th>
                  <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Notes</th>
                </tr>
              </thead>
              <tbody>
                {probed.map((r) => (
                  <tr key={r.url} className="border-t border-rule align-top hover:bg-paper transition-colors">
                    <td className="p-3">
                      <div className="font-sans font-medium">{r.name}</div>
                      <a
                        className="text-xs text-muted hover:text-accent hover:underline break-all"
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.url}
                      </a>
                    </td>
                    <td className="p-3 tabular-nums">{r.itemCount}</td>
                    <td className="p-3">
                      <span
                        className={
                          "text-[10px] font-sans font-medium uppercase tracking-label px-2 py-0.5 border " +
                          (r.alreadyInDb
                            ? "border-rule text-muted bg-panel"
                            : r.ok
                              ? "border-rule text-ink bg-panel"
                              : "border-accent text-accent bg-panel")
                        }
                      >
                        {r.alreadyInDb ? "DUP" : r.ok ? "OK" : "FAIL"}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-muted">
                      {r.alreadyInDb && (
                        <div>URL already in feeds table — will skip.</div>
                      )}
                      {r.firstHeadline && (
                        <div className="line-clamp-2">
                          First item: {r.firstHeadline}
                        </div>
                      )}
                      {r.error && (
                        <div className="text-accent">{r.error}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {newCount > 0 && (
            <Card>
              <form action={apply}>
                <Button type="submit">
                  Add {newCount} working feed{newCount === 1 ? "" : "s"} to
                  database
                </Button>
                <p className="text-xs text-muted mt-2">
                  Re-probes live during the action (about 30s), then inserts
                  every URL that returned items and isn&apos;t already in the
                  feeds table.
                </p>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
