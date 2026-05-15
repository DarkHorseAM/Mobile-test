import {
  listArticles,
  getArticleMatches,
  listFeedsForFilter,
  listIndicatorPatternsForFilter,
} from "@/lib/db/queries";
import { Badge, Button, Card, Input, Label } from "@/components/ui/ui";
import { RunScanButton } from "@/components/run-scan-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  outlet?: string | string[];
  pattern?: string | string[];
  brand?: string;
  from?: string;
  to?: string;
  page?: string;
  sort?: string;
  minConfidence?: string;
};

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const pageSize = 50;

  const outlets = toArray(sp.outlet);
  const patternSlugs = toArray(sp.pattern);
  const sort: "date" | "confidence" = sp.sort === "confidence" ? "confidence" : "date";
  const minConfidence = sp.minConfidence ? Math.max(0, Number(sp.minConfidence) || 0) : 0;

  const [{ rows, total }, allFeeds, allPatterns] = await Promise.all([
    listArticles({
      q: sp.q,
      outlets,
      patternSlugs,
      brand: sp.brand,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to + "T23:59:59Z") : undefined,
      minConfidence,
      sort,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    listFeedsForFilter(),
    listIndicatorPatternsForFilter(),
  ]);

  const matchMap = await getArticleMatches(rows.map((r) => r.id));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const sortToggleParams = new URLSearchParams();
  if (sp.q) sortToggleParams.set("q", sp.q);
  if (sp.brand) sortToggleParams.set("brand", sp.brand);
  if (sp.from) sortToggleParams.set("from", sp.from);
  if (sp.to) sortToggleParams.set("to", sp.to);
  if (minConfidence > 0) sortToggleParams.set("minConfidence", String(minConfidence));
  outlets.forEach((o) => sortToggleParams.append("outlet", o));
  patternSlugs.forEach((s) => sortToggleParams.append("pattern", s));
  if (sort === "date") sortToggleParams.set("sort", "confidence");
  const sortToggleHref = `/browse?${sortToggleParams.toString()}`;

  const exportHref = `/api/export?${new URLSearchParams({
    ...(sp.q ? { q: sp.q } : {}),
    ...(sp.brand ? { brand: sp.brand } : {}),
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
    ...outlets.reduce((a, o, i) => ({ ...a, [`outlet${i}`]: o }), {}),
    ...patternSlugs.reduce((a, p, i) => ({ ...a, [`pattern${i}`]: p }), {}),
  }).toString()}`;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-sans font-bold text-3xl tracking-tight">Browse Coverage</h1>
          <p className="mt-1 text-sm text-muted">{total.toLocaleString()} matching articles</p>
        </div>
        <div className="flex gap-2">
          <a href={exportHref}>
            <Button variant="outline">Export CSV</Button>
          </a>
          <RunScanButton />
        </div>
      </div>

      <Card>
        <form method="get" className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="q">Search headline / summary</Label>
            <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="e.g. sleep, holiday, salary" />
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" defaultValue={sp.brand ?? ""} />
          </div>
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" type="date" defaultValue={sp.from ?? ""} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" type="date" defaultValue={sp.to ?? ""} />
          </div>
          <div>
            <Label htmlFor="minConfidence">Min confidence</Label>
            <Input
              id="minConfidence"
              name="minConfidence"
              type="number"
              min={0}
              defaultValue={minConfidence > 0 ? String(minConfidence) : ""}
              placeholder="0"
            />
          </div>
          {sort === "confidence" && <input type="hidden" name="sort" value="confidence" />}
          <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Outlets</Label>
              <select
                name="outlet"
                multiple
                defaultValue={outlets}
                className="w-full bg-panel border border-rule p-2 text-sm font-mono text-ink h-28 focus:border-accent focus:outline-none"
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
                className="w-full bg-panel border border-rule p-2 text-sm font-mono text-ink h-28 focus:border-accent focus:outline-none"
              >
                {allPatterns.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="md:col-span-6 flex gap-2">
            <Button type="submit">Apply filters</Button>
            <Link
              href="/browse"
              className="self-center text-[11px] font-sans font-medium uppercase tracking-label text-ink hover:text-accent"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="bg-panel border border-rule overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead className="border-b border-rule">
            <tr className="text-left">
              <th className="p-3 w-24 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Date</th>
              <th className="p-3 w-40 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Outlet</th>
              <th className="p-3 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Headline</th>
              <th className="p-3 w-40 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Brand</th>
              <th className="p-3 w-24 text-[11px] font-sans font-medium uppercase tracking-label text-muted">
                <Link
                  href={sortToggleHref}
                  className={
                    "inline-flex items-center gap-1 hover:text-accent " +
                    (sort === "confidence" ? "text-accent" : "")
                  }
                >
                  Confidence
                  <span aria-hidden>{sort === "confidence" ? "↓" : "↕"}</span>
                </Link>
              </th>
              <th className="p-3 w-56 text-[11px] font-sans font-medium uppercase tracking-label text-muted">Patterns</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="p-8 text-center text-muted" colSpan={6}>
                  <span className="font-display text-2xl text-ink">nothing yet</span>
                  <div className="mt-1 text-sm">No articles match. Try running a scan or relaxing your filters.</div>
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-rule hover:bg-paper transition-colors">
                <td className="p-3 text-muted whitespace-nowrap">
                  {r.publishedAt ? new Date(r.publishedAt).toISOString().slice(0, 10) : "—"}
                </td>
                <td className="p-3 whitespace-nowrap">{r.outlet}</td>
                <td className="p-3">
                  <a className="hover:text-accent hover:underline" href={r.url} target="_blank" rel="noreferrer">
                    {r.headline}
                  </a>
                  {r.summary && <div className="text-xs text-muted mt-1 line-clamp-2">{r.summary}</div>}
                </td>
                <td className="p-3">{r.brand ?? <span className="text-muted">—</span>}</td>
                <td className="p-3 tabular-nums">{r.confidenceScore}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(matchMap.get(r.id) ?? []).map((m) => (
                      <Badge key={m.slug}>{m.label}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination basePath="/browse" sp={sp} page={page} totalPages={totalPages} />
      )}
    </div>
  );
}

function Pagination({
  basePath,
  sp,
  page,
  totalPages,
}: {
  basePath: string;
  sp: SP;
  page: number;
  totalPages: number;
}) {
  const make = (p: number) => {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.brand) params.set("brand", sp.brand);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (sp.minConfidence) params.set("minConfidence", sp.minConfidence);
    if (sp.sort) params.set("sort", sp.sort);
    toArray(sp.outlet).forEach((o) => params.append("outlet", o));
    toArray(sp.pattern).forEach((s) => params.append("pattern", s));
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
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
