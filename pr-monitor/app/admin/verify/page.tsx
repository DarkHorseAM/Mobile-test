import {
  listArticles,
  getArticleMatches,
  listFeedsForFilter,
  listIndicatorPatternsForFilter,
  setVerifyState,
  type VerifyState,
} from "@/lib/db/queries";
import { Badge, Button, Card, Label } from "@/components/ui/ui";
import Link from "next/link";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type SP = {
  state?: string;
  outlet?: string | string[];
  pattern?: string | string[];
  page?: string;
};

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseState(s: string | undefined): VerifyState {
  if (s === "verified" || s === "rejected" || s === "reviewed" || s === "any") return s;
  return "unreviewed";
}

async function setStateAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const next = String(formData.get("next"));
  if (!Number.isFinite(id) || id <= 0) return;
  if (next !== "verified" && next !== "rejected" && next !== "unreviewed") return;
  await setVerifyState(id, next);
  revalidatePath("/admin/verify");
  revalidatePath("/browse");
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const state = parseState(sp.state);
  const outlets = toArray(sp.outlet);
  const patternSlugs = toArray(sp.pattern);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 50;

  const [{ rows, total }, allFeeds, allPatterns] = await Promise.all([
    listArticles({
      outlets,
      patternSlugs,
      verifyState: state,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    listFeedsForFilter(),
    listIndicatorPatternsForFilter(),
  ]);

  const matchMap = await getArticleMatches(rows.map((r) => r.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-sans font-bold text-3xl tracking-tight">Verify queue</h1>
        <p className="mt-1 text-sm text-muted">
          Mark articles as verified digital PR or not. {total.toLocaleString()}{" "}
          {state === "unreviewed"
            ? "unreviewed"
            : state === "verified"
              ? "verified"
              : state === "rejected"
                ? "rejected"
                : state === "reviewed"
                  ? "reviewed (verified or rejected)"
                  : "total"}{" "}
          article{total === 1 ? "" : "s"}.
        </p>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label htmlFor="state">State</Label>
            <select
              id="state"
              name="state"
              defaultValue={state}
              className="w-full bg-panel border border-rule px-3 h-9 text-sm font-mono text-ink focus:border-accent focus:outline-none"
            >
              <option value="unreviewed">Unreviewed</option>
              <option value="verified">Verified PR</option>
              <option value="rejected">Not PR</option>
              <option value="reviewed">All reviewed</option>
              <option value="any">All articles</option>
            </select>
          </div>
          <div>
            <Label>Outlets</Label>
            <select
              name="outlet"
              multiple
              defaultValue={outlets}
              className="w-full bg-panel border border-rule p-2 text-sm font-mono text-ink h-24 focus:border-accent focus:outline-none"
            >
              {allFeeds.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Patterns</Label>
            <select
              name="pattern"
              multiple
              defaultValue={patternSlugs}
              className="w-full bg-panel border border-rule p-2 text-sm font-mono text-ink h-24 focus:border-accent focus:outline-none"
            >
              {allPatterns.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button type="submit">Apply filters</Button>
            <Link
              href="/admin/verify"
              className="self-center text-[11px] font-sans font-medium uppercase tracking-label text-ink hover:text-accent"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="bg-panel border border-rule overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <span className="font-display text-2xl text-ink">queue clear</span>
            <div className="mt-1 text-sm text-muted">
              {state === "unreviewed"
                ? "No unreviewed articles. Come back after the next scan."
                : "No articles match the current filters."}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((r) => {
              const matchList = matchMap.get(r.id) ?? [];
              const status: "verified" | "rejected" | "unreviewed" =
                r.verifiedPr === true
                  ? "verified"
                  : r.verifiedPr === false
                    ? "rejected"
                    : "unreviewed";
              return (
                <li key={r.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted whitespace-nowrap">
                        {r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "—"}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="font-sans font-medium">{r.outlet}</span>
                      {r.byline && (
                        <>
                          <span className="text-muted">·</span>
                          <span className="text-muted">by {r.byline}</span>
                        </>
                      )}
                      {status === "verified" && (
                        <span className="text-[10px] font-sans font-medium uppercase tracking-label px-2 py-0.5 border border-accent text-accent bg-panel">
                          Verified PR
                        </span>
                      )}
                      {status === "rejected" && (
                        <span className="text-[10px] font-sans font-medium uppercase tracking-label px-2 py-0.5 border border-rule text-muted bg-panel">
                          Not PR
                        </span>
                      )}
                    </div>
                    <a
                      className="block mt-1 text-base font-sans font-medium hover:text-accent hover:underline break-words"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.headline}
                    </a>
                    {r.summary && (
                      <p className="text-xs text-muted mt-1 line-clamp-2 break-words">
                        {r.summary}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {matchList.map((m) => (
                        <Badge key={m.slug}>{m.label}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 md:flex-col md:w-40 shrink-0">
                    {status === "unreviewed" ? (
                      <>
                        <form action={setStateAction} className="flex-1 md:flex-none">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="next" value="verified" />
                          <Button type="submit" className="w-full">✓ Verify PR</Button>
                        </form>
                        <form action={setStateAction} className="flex-1 md:flex-none">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="next" value="rejected" />
                          <Button type="submit" variant="outline" className="w-full">✗ Not PR</Button>
                        </form>
                      </>
                    ) : (
                      <form action={setStateAction} className="flex-1 md:flex-none">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="next" value="unreviewed" />
                        <Button type="submit" variant="outline" className="w-full">Undo</Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination sp={sp} page={page} totalPages={totalPages} />
      )}
    </div>
  );
}

function Pagination({
  sp,
  page,
  totalPages,
}: {
  sp: SP;
  page: number;
  totalPages: number;
}) {
  const make = (p: number) => {
    const params = new URLSearchParams();
    if (sp.state) params.set("state", sp.state);
    toArray(sp.outlet).forEach((o) => params.append("outlet", o));
    toArray(sp.pattern).forEach((s) => params.append("pattern", s));
    params.set("page", String(p));
    return `/admin/verify?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-4 text-[11px] font-sans font-medium uppercase tracking-label">
        {page > 1 && (
          <Link className="text-ink hover:text-accent" href={make(page - 1)}>
            ← Previous
          </Link>
        )}
        {page < totalPages && (
          <Link className="text-ink hover:text-accent" href={make(page + 1)}>
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
