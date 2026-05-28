import { db } from "./client";
import { articles, matches, patterns, feeds } from "./schema";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";

export type VerifyState = "unreviewed" | "verified" | "rejected" | "reviewed" | "any";

export type ArticleFilters = {
  from?: Date;
  to?: Date;
  outlets?: string[];
  patternSlugs?: string[];
  q?: string;
  hidden?: boolean;
  verifyState?: VerifyState;
  byline?: string;
  limit?: number;
  offset?: number;
};

function buildWhere(f: ArticleFilters) {
  const where = [eq(articles.hidden, f.hidden ?? false)];
  if (f.from) where.push(gte(articles.publishedAt, f.from));
  if (f.to) where.push(lte(articles.publishedAt, f.to));
  if (f.outlets && f.outlets.length > 0) where.push(inArray(articles.outlet, f.outlets));
  if (f.q) {
    where.push(
      sql`(${articles.headline} ilike ${"%" + f.q + "%"} or ${articles.summary} ilike ${"%" + f.q + "%"})`,
    );
  }
  if (f.verifyState === "verified") where.push(eq(articles.verifiedPr, true));
  else if (f.verifyState === "rejected") where.push(eq(articles.verifiedPr, false));
  else if (f.verifyState === "unreviewed") where.push(isNull(articles.verifiedPr));
  else if (f.verifyState === "reviewed") where.push(isNotNull(articles.verifiedPr));
  if (f.byline) where.push(eq(articles.byline, f.byline));
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

  const rows = await db
    .select({
      id: articles.id,
      url: articles.url,
      outlet: articles.outlet,
      headline: articles.headline,
      summary: articles.summary,
      publishedAt: articles.publishedAt,
      verifiedPr: articles.verifiedPr,
      byline: articles.byline,
    })
    .from(articles)
    .where(filtered)
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(filtered);

  return { rows, total: count };
}

export async function countUnreviewed(): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(articles)
    .where(and(eq(articles.hidden, false), isNull(articles.verifiedPr)));
  return count;
}

export async function setVerifyState(articleId: number, state: "verified" | "rejected" | "unreviewed") {
  const value = state === "verified" ? true : state === "rejected" ? false : null;
  const verifiedAt = state === "unreviewed" ? null : new Date();
  await db
    .update(articles)
    .set({ verifiedPr: value, verifiedAt })
    .where(eq(articles.id, articleId));
}

export type JournalistRow = {
  byline: string;
  outlet: string;
  storyCount: number;
  lastSeen: Date | null;
};

export async function listJournalists(): Promise<JournalistRow[]> {
  const rows = await db
    .select({
      byline: articles.byline,
      outlet: articles.outlet,
      storyCount: sql<number>`count(*)::int`,
      lastSeen: sql<Date | null>`max(${articles.publishedAt})`,
    })
    .from(articles)
    .where(
      and(
        eq(articles.verifiedPr, true),
        eq(articles.hidden, false),
        isNotNull(articles.byline),
      ),
    )
    .groupBy(articles.byline, articles.outlet)
    .orderBy(sql`count(*) desc`, sql`max(${articles.publishedAt}) desc`);
  return rows.map((r) => ({
    byline: r.byline ?? "",
    outlet: r.outlet,
    storyCount: r.storyCount,
    lastSeen: r.lastSeen,
  }));
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
