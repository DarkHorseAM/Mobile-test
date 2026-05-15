import { db } from "@/lib/db/client";
import { feeds } from "@/lib/db/schema";
import { FEED_CANDIDATES } from "@/lib/db/feed-candidates";
import { fetchFeed } from "@/lib/scanner/fetch";
import { Button, Card } from "@/components/ui/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";

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

type ApplyResult = { name: string; url: string; inserted: boolean };

const STORE: {
  probed: ProbeResult[] | null;
  applied: ApplyResult[] | null;
  appliedAt: Date | null;
} = { probed: null, applied: null, appliedAt: null };

async function probe() {
  "use server";
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

  STORE.probed = results.map((r, i) => {
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
  STORE.applied = null;
  STORE.appliedAt = null;
  revalidatePath("/admin/feeds-import");
  redirect("/admin/feeds-import");
}

async function apply() {
  "use server";
  if (!STORE.probed) return;
  const toInsert = STORE.probed.filter((r) => r.ok && !r.alreadyInDb);
  const applied: ApplyResult[] = [];
  for (const r of toInsert) {
    const ins = await db
      .insert(feeds)
      .values({ name: r.name, url: r.url, tier: r.tier })
      .onConflictDoNothing({ target: feeds.url })
      .returning({ id: feeds.id });
    applied.push({ name: r.name, url: r.url, inserted: ins.length > 0 });
  }
  STORE.applied = applied;
  STORE.appliedAt = new Date();
  revalidatePath("/admin/feeds-import");
  redirect("/admin/feeds-import");
}

export default function FeedsImportPage() {
  const probed = STORE.probed;
  const applied = STORE.applied;
  const okCount = probed?.filter((r) => r.ok).length ?? 0;
  const failCount = probed?.filter((r) => !r.ok).length ?? 0;
  const newCount = probed?.filter((r) => r.ok && !r.alreadyInDb).length ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Import candidate feeds</h1>
        <p className="text-sm text-muted-foreground">
          Probes the {FEED_CANDIDATES.length} candidate URLs in{" "}
          <code className="text-xs">lib/db/feed-candidates.ts</code> and
          reports which return parseable RSS. Nothing is written to the
          database until you click <strong>Add to database</strong> below the
          results table.
        </p>
      </div>

      <Card>
        <form action={probe}>
          <Button type="submit">
            {probed ? "Re-probe candidates" : "Probe candidates"}
          </Button>
        </form>
      </Card>

      {probed && (
        <>
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b text-sm text-muted-foreground">
              {okCount} ok · {failCount} failed · {newCount} new to insert
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="p-3">Outlet</th>
                  <th className="p-3 w-20">Items</th>
                  <th className="p-3 w-24">Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {probed.map((r) => (
                  <tr key={r.url} className="border-t align-top">
                    <td className="p-3">
                      <div className="font-medium">{r.name}</div>
                      <a
                        className="text-xs text-muted-foreground hover:underline break-all"
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.url}
                      </a>
                    </td>
                    <td className="p-3 tabular-nums">{r.itemCount}</td>
                    <td className="p-3">
                      {r.alreadyInDb ? (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          DUP
                        </span>
                      ) : r.ok ? (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-100 text-green-800">
                          OK
                        </span>
                      ) : (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-100 text-red-800">
                          FAIL
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {r.alreadyInDb && (
                        <div>URL already in feeds table — will skip.</div>
                      )}
                      {r.firstHeadline && (
                        <div className="line-clamp-2">
                          First item: {r.firstHeadline}
                        </div>
                      )}
                      {r.error && (
                        <div className="text-red-700 font-mono">{r.error}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {newCount > 0 && !applied && (
            <Card>
              <form action={apply}>
                <Button type="submit">
                  Add {newCount} working feed{newCount === 1 ? "" : "s"} to
                  database
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Inserts as <code>is_active = true</code>. Existing feeds in
                  the database are untouched.
                </p>
              </form>
            </Card>
          )}
        </>
      )}

      {applied && (
        <Card>
          <h2 className="font-medium mb-2">Applied</h2>
          <p className="text-sm text-muted-foreground mb-3">
            {applied.filter((a) => a.inserted).length} of {applied.length}{" "}
            inserted. (Any not inserted hit a unique-URL conflict and were
            silently skipped.)
          </p>
          <ul className="space-y-1 text-sm">
            {applied.map((a) => (
              <li key={a.url}>
                <span
                  className={
                    "inline-block min-w-12 text-xs font-mono px-2 py-0.5 rounded mr-2 " +
                    (a.inserted
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-100 text-slate-700")
                  }
                >
                  {a.inserted ? "NEW" : "SKIP"}
                </span>
                {a.name}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
