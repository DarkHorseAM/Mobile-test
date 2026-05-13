import { db } from "./client";
import { articles, matches, patterns } from "./schema";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";

export async function topBrands(since: Date, limit = 10) {
  return db
    .select({
      brand: articles.brand,
      count: sql<number>`count(*)::int`,
    })
    .from(articles)
    .where(and(isNotNull(articles.brand), gte(articles.publishedAt, since), eq(articles.hidden, false)))
    .groupBy(articles.brand)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function topOutlets(since: Date, limit = 10) {
  return db
    .select({
      outlet: articles.outlet,
      count: sql<number>`count(*)::int`,
    })
    .from(articles)
    .where(and(gte(articles.publishedAt, since), eq(articles.hidden, false)))
    .groupBy(articles.outlet)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function topPatterns(since: Date, limit = 10) {
  return db
    .select({
      slug: patterns.slug,
      label: patterns.label,
      count: sql<number>`count(*)::int`,
    })
    .from(matches)
    .innerJoin(patterns, eq(patterns.id, matches.patternId))
    .innerJoin(articles, eq(articles.id, matches.articleId))
    .where(and(gte(articles.publishedAt, since), eq(articles.hidden, false)))
    .groupBy(patterns.slug, patterns.label)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function patternCountsForRange(from: Date, to: Date) {
  return db
    .select({
      slug: patterns.slug,
      label: patterns.label,
      count: sql<number>`count(*)::int`,
    })
    .from(matches)
    .innerJoin(patterns, eq(patterns.id, matches.patternId))
    .innerJoin(articles, eq(articles.id, matches.articleId))
    .where(
      and(
        gte(articles.publishedAt, from),
        sql`${articles.publishedAt} < ${to}`,
        eq(articles.hidden, false),
      ),
    )
    .groupBy(patterns.slug, patterns.label);
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","by","from","as","is","are","was","were","be","been","being","this","that","these","those","it","its","you","your","we","our","they","their","he","she","his","her","i","my","me","not","no","yes","do","does","did","have","has","had","will","would","can","could","should","may","might","new","best","most","top","says","said","after","before","into","out","over","under","up","down","more","less","than","then","also","just","like","than","about","what","when","where","who","why","how","uk","britain","british","british","brit","brits","-","–","&","&amp;"
]);

export async function headlineWordFrequencies(since: Date, limit = 60) {
  const rows = await db
    .select({ headline: articles.headline })
    .from(articles)
    .where(and(gte(articles.publishedAt, since), eq(articles.hidden, false)));

  const counts = new Map<string, number>();
  for (const r of rows) {
    const words = r.headline.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}
