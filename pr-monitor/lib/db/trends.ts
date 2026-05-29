import { db } from "./client";
import { articles, matches, patterns } from "./schema";
import { and, desc, eq, gte, sql, SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";

function baseFilters(since: Date, to: Date | null, verifiedOnly: boolean): SQL[] {
  const filters: SQL[] = [
    gte(articles.publishedAt, since),
    eq(articles.hidden, false),
  ];
  if (to) filters.push(sql`${articles.publishedAt} < ${to}`);
  if (verifiedOnly) filters.push(eq(articles.verifiedPr, true));
  return filters;
}

export async function topOutlets(since: Date, opts: { verifiedOnly?: boolean; limit?: number } = {}) {
  const { verifiedOnly = false, limit = 10 } = opts;
  return db
    .select({
      outlet: articles.outlet,
      count: sql<number>`count(*)::int`,
    })
    .from(articles)
    .where(and(...baseFilters(since, null, verifiedOnly)))
    .groupBy(articles.outlet)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function topPatterns(since: Date, opts: { verifiedOnly?: boolean; limit?: number } = {}) {
  const { verifiedOnly = false, limit = 10 } = opts;
  return db
    .select({
      slug: patterns.slug,
      label: patterns.label,
      count: sql<number>`count(*)::int`,
    })
    .from(matches)
    .innerJoin(patterns, eq(patterns.id, matches.patternId))
    .innerJoin(articles, eq(articles.id, matches.articleId))
    .where(and(...baseFilters(since, null, verifiedOnly)))
    .groupBy(patterns.slug, patterns.label)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export async function patternCountsForRange(
  from: Date,
  to: Date,
  opts: { verifiedOnly?: boolean } = {},
) {
  const { verifiedOnly = false } = opts;
  return db
    .select({
      slug: patterns.slug,
      label: patterns.label,
      count: sql<number>`count(*)::int`,
    })
    .from(matches)
    .innerJoin(patterns, eq(patterns.id, matches.patternId))
    .innerJoin(articles, eq(articles.id, matches.articleId))
    .where(and(...baseFilters(from, to, verifiedOnly)))
    .groupBy(patterns.slug, patterns.label);
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with","by","from","as","is","are","was","were","be","been","being","this","that","these","those","it","its","you","your","we","our","they","their","he","she","his","her","i","my","me","not","no","yes","do","does","did","have","has","had","will","would","can","could","should","may","might","new","best","most","top","says","said","after","before","into","out","over","under","up","down","more","less","than","then","also","just","like","than","about","what","when","where","who","why","how","uk","britain","british","british","brit","brits","-","–","&","&amp;"
]);

// The tokenize-and-count is the slowest thing on the Trends page —
// every render fetches all headlines for the window into memory and
// re-counts them. Cache for an hour, keyed on the since-rounded-to-hour
// plus the verifiedOnly flag so the two views don't share cache entries.
const _cachedHeadlineWordFrequencies = unstable_cache(
  async (sinceHourMs: number, limit: number, verifiedOnly: boolean) => {
    const since = new Date(sinceHourMs);
    const rows = await db
      .select({ headline: articles.headline })
      .from(articles)
      .where(and(...baseFilters(since, null, verifiedOnly)));

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
  },
  ["headline-word-frequencies"],
  { revalidate: 3600 },
);

export async function headlineWordFrequencies(
  since: Date,
  opts: { verifiedOnly?: boolean; limit?: number } = {},
) {
  const { verifiedOnly = false, limit = 60 } = opts;
  const HOUR_MS = 60 * 60 * 1000;
  const sinceHourMs = Math.floor(since.getTime() / HOUR_MS) * HOUR_MS;
  return _cachedHeadlineWordFrequencies(sinceHourMs, limit, verifiedOnly);
}
