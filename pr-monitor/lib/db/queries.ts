import { db } from "./client";
import { articles, matches, patterns, feeds } from "./schema";
import { and, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";

export type SortKey = "date" | "confidence";

export type ArticleFilters = {
  from?: Date;
  to?: Date;
  outlets?: string[];
  patternSlugs?: string[];
  brand?: string;
  q?: string;
  hidden?: boolean;
  minConfidence?: number;
  sort?: SortKey;
  limit?: number;
  offset?: number;
};

function buildWhere(f: ArticleFilters) {
  const where = [eq(articles.hidden, f.hidden ?? false)];
  if (f.from) where.push(gte(articles.publishedAt, f.from));
  if (f.to) where.push(lte(articles.publishedAt, f.to));
  if (f.outlets && f.outlets.length > 0) where.push(inArray(articles.outlet, f.outlets));
  if (f.brand) where.push(ilike(articles.brand, `%${f.brand}%`));
  if (typeof f.minConfidence === "number" && f.minConfidence > 0) {
    where.push(gte(articles.confidenceScore, f.minConfidence));
  }
  if (f.q) {
    where.push(
      sql`(${articles.headline} ilike ${"%" + f.q + "%"} or ${articles.summary} ilike ${"%" + f.q + "%"})`,
    );
  }
  return and(...where);
}

export async function listArticles(f: ArticleFilters) {
  const limit = Math.min(f.limit ?? 100, 500);
  const offset = f.offset ?? 0;

  let articleIds: number[] | null = null;
  if (f.patternSlugs && f.patternSlugs.length > 0) {
    const ids = await db
      .selectDistinct({ id: matches.articleId })
      .from(matches)
      .innerJoin(patterns, eq(patterns.id, matches.patternId))
      .where(inArray(patterns.slug, f.patternSlugs));
    articleIds = ids.map((r) => r.id);
    if (articleIds.length === 0) return { rows: [], total: 0 };
  }

  const baseWhere = buildWhere(f);
  const filtered = articleIds
    ? and(baseWhere, inArray(articles.id, articleIds))
    : baseWhere;

  const orderBy =
    f.sort === "confidence"
      ? [desc(articles.confidenceScore), desc(articles.publishedAt)]
      : [desc(articles.publishedAt)];

  const rows = await db
    .select({
      id: articles.id,
      url: articles.url,
      outlet: articles.outlet,
      headline: articles.headline,
      summary: articles.summary,
      brand: articles.brand,
      publishedAt: articles.publishedAt,
      confidenceScore: articles.confidenceScore,
    })
    .from(articles)
    .where(filtered)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(filtered);

  return { rows, total: count };
}

export async function getArticleMatches(articleIds: number[]) {
  if (articleIds.length === 0) return new Map<number, { slug: string; label: string }[]>();
  const rows = await db
    .select({
      articleId: matches.articleId,
      slug: patterns.slug,
      label: patterns.label,
    })
    .from(matches)
    .innerJoin(patterns, eq(patterns.id, matches.patternId))
    .where(inArray(matches.articleId, articleIds));
  const out = new Map<number, { slug: string; label: string }[]>();
  for (const r of rows) {
    const list = out.get(r.articleId) ?? [];
    list.push({ slug: r.slug, label: r.label });
    out.set(r.articleId, list);
  }
  return out;
}

export async function listFeedsForFilter() {
  return db.select({ name: feeds.name }).from(feeds).orderBy(feeds.name);
}

export async function listIndicatorPatternsForFilter() {
  return db
    .select({ slug: patterns.slug, label: patterns.label })
    .from(patterns)
    .where(and(eq(patterns.kind, "indicator"), eq(patterns.isActive, true)))
    .orderBy(patterns.label);
}
