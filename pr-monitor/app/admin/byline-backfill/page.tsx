import {
  countArticlesNeedingByline,
  listArticlesNeedingByline,
  updateArticleByline,
} from "@/lib/db/queries";
import { fetchByline } from "@/lib/scanner/extract-byline";
import { Button, Card } from "@/components/ui/ui";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 25;

type BatchResult = {
  total: number;
  withByline: number;
  noByline: number;
  errored: number;
  durationMs: number;
  samples: { outlet: string; byline: string | null; error: string | null }[];
  failuresByOutlet: { outlet: string; count: number; message: string }[];
};

const STORE: { last: BatchResult | null } = { last: null };

async function processBatch() {
  "use server";
  const started = Date.now();
  const todo = await listArticlesNeedingByline(BATCH_SIZE);
  if (todo.length === 0) {
    STORE.last = {
      total: 0,
      withByline: 0,
      noByline: 0,
      errored: 0,
      durationMs: 0,
      samples: [],
      failuresByOutlet: [],
    };
    revalidatePath("/admin/byline-backfill");
    redirect("/admin/byline-backfill");
  }

  const results = await Promise.all(
    todo.map(async (a) => {
      const res = await fetchByline(a.url);
      return { article: a, res };
    }),
  );

  let withByline = 0;
  let noByline = 0;
  let errored = 0;
  const samples: BatchResult["samples"] = [];
  const failuresByOutletMap = new Map<string, { count: number; message: string }>();

  for (const { article, res } of results) {
    if (res.ok) {
      await updateArticleByline(article.id, res.byline);
      if (res.byline) {
        withByline += 1;
        if (samples.length < 8) {
          samples.push({ outlet: article.outlet, byline: res.byline, error: null });
        }
      } else {
        noByline += 1;
      }
    } else {
      errored += 1;
      const prev = failuresByOutletMap.get(article.outlet);
      failuresByOutletMap.set(article.outlet, {
        count: (prev?.count ?? 0) + 1,
        message: res.error,
      });
      if (samples.length < 8) {
        samples.push({ outlet: article.outlet, byline: null, error: res.error });
      }
    }
  }

  const failuresByOutlet = [...failuresByOutletMap.entries()]
    .map(([outlet, info]) => ({ outlet, count: info.count, message: info.message }))
    .sort((a, b) => b.count - a.count);

  STORE.last = {
    total: results.length,
    withByline,
    noByline,
    errored,
    durationMs: Date.now() - started,
    samples,
    failuresByOutlet,
  };

  revalidatePath("/admin/byline-backfill");
  revalidatePath("/journalists");
  redirect("/admin/byline-backfill");
}

export default async function BylineBackfillPage() {
  const remaining = await countArticlesNeedingByline();
  const last = STORE.last;
  const done = remaining === 0;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Byline backfill</h1>
        <p className="mt-1 text-sm text-muted">
          Fetches the HTML of articles missing a byline and extracts the
          author from JSON-LD or <code className="text-xs">&lt;meta name=&quot;author&quot;&gt;</code>.
          Processes {BATCH_SIZE} at a time so each run finishes well
          under the function timeout. Articles where the byline isn&apos;t
          findable get their byline set to NULL permanently and are
          excluded from future batches.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <div className="text-[11px] font-sans font-medium uppercase tracking-label text-muted">
              Remaining
            </div>
            <div className="text-2xl font-sans font-bold tabular-nums mt-1">
              {remaining.toLocaleString()}
            </div>
          </div>
          <form action={processBatch}>
            <Button type="submit" disabled={done}>
              {done ? "All processed" : `Process next ${Math.min(BATCH_SIZE, remaining)}`}
            </Button>
          </form>
        </div>
      </Card>

      {last && (
        <div className="space-y-4">
          <h2 className="font-sans font-medium text-lg">Last batch</h2>
          <div className="bg-panel border border-rule overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-rule">
              <Stat label="Processed" value={last.total} />
              <Stat label="Byline found" value={last.withByline} accent />
              <Stat label="No byline" value={last.noByline} />
              <Stat label="Errored" value={last.errored} />
            </div>
            <div className="border-t border-rule px-5 py-2 text-xs text-muted">
              Wall clock: {(last.durationMs / 1000).toFixed(1)}s
            </div>
          </div>

          {last.samples.length > 0 && (
            <div className="bg-panel border border-rule overflow-hidden">
              <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                Sample
              </div>
              <ul className="divide-y divide-rule text-sm font-mono">
                {last.samples.map((s, i) => (
                  <li key={i} className="px-5 py-2 flex items-baseline justify-between gap-4">
                    <span className="font-sans font-medium text-xs">{s.outlet}</span>
                    {s.byline ? (
                      <span className="text-ink">{s.byline}</span>
                    ) : s.error ? (
                      <span className="text-accent text-xs">{s.error}</span>
                    ) : (
                      <span className="text-muted text-xs">no byline in page</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {last.failuresByOutlet.length > 0 && (
            <div className="bg-panel border border-rule overflow-hidden">
              <div className="px-5 py-3 border-b border-rule text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                Failing outlets in last batch
              </div>
              <ul className="divide-y divide-rule text-sm">
                {last.failuresByOutlet.map((f) => (
                  <li key={f.outlet} className="px-5 py-2 flex items-baseline justify-between gap-4">
                    <span className="font-sans font-medium">{f.outlet}</span>
                    <span className="flex items-baseline gap-3 text-xs">
                      <span className="text-muted">{f.message}</span>
                      <span className="tabular-nums text-accent font-sans font-medium uppercase tracking-label text-[10px]">
                        {f.count}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="p-4">
      <div className="text-[11px] font-sans font-medium uppercase tracking-label text-muted">
        {label}
      </div>
      <div
        className={
          "text-2xl font-sans font-bold tabular-nums mt-1 " +
          (accent ? "text-accent" : "text-ink")
        }
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
