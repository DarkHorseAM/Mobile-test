import { listArticles, getArticleMatches } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/\r?\n/g, " ");
  if (s.includes(",") || s.includes("\"")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const outlets: string[] = [];
  const patternSlugs: string[] = [];
  for (const [k, v] of sp.entries()) {
    if (k.startsWith("outlet")) outlets.push(v);
    if (k.startsWith("pattern")) patternSlugs.push(v);
  }

  const { rows } = await listArticles({
    q: sp.get("q") ?? undefined,
    brand: sp.get("brand") ?? undefined,
    from: sp.get("from") ? new Date(sp.get("from")!) : undefined,
    to: sp.get("to") ? new Date(sp.get("to")! + "T23:59:59Z") : undefined,
    outlets: outlets.length ? outlets : undefined,
    patternSlugs: patternSlugs.length ? patternSlugs : undefined,
    limit: 500,
  });

  const matchMap = await getArticleMatches(rows.map((r) => r.id));

  const header = ["published_at", "outlet", "headline", "brand", "patterns", "url"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const patterns = (matchMap.get(r.id) ?? []).map((m) => m.label).join("; ");
    lines.push(
      [
        r.publishedAt ? new Date(r.publishedAt).toISOString() : "",
        r.outlet,
        r.headline,
        r.brand ?? "",
        patterns,
        r.url,
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = lines.join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pr-monitor-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
