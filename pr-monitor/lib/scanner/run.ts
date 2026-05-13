import { db } from "@/lib/db/client";
import { feeds, patterns, articles, matches, scanRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { fetchFeed } from "./fetch";
import { compilePatterns, findIndicatorMatches, extractBrand } from "./match";

export type ScanResult = {
  feedsScanned: number;
  articlesSeen: number;
  articlesNew: number;
  matchesNew: number;
  runId: number;
  errors: { feed: string; message: string }[];
};

export async function runScan(): Promise<ScanResult> {
  const [run] = await db.insert(scanRuns).values({}).returning();

  const activeFeeds = await db.select().from(feeds).where(eq(feeds.isActive, true));
  const activePatterns = await db.select().from(patterns).where(eq(patterns.isActive, true));
  const indicators = compilePatterns(activePatterns.filter((p) => p.kind === "indicator"));
  const brandExtractors = compilePatterns(activePatterns.filter((p) => p.kind === "brand"));

  const result: ScanResult = {
    feedsScanned: 0,
    articlesSeen: 0,
    articlesNew: 0,
    matchesNew: 0,
    runId: run.id,
    errors: [],
  };

  for (const feed of activeFeeds) {
    let items: Awaited<ReturnType<typeof fetchFeed>>;
    try {
      items = await fetchFeed(feed.url);
    } catch (e) {
      result.errors.push({ feed: feed.name, message: (e as Error).message });
      continue;
    }
    result.feedsScanned += 1;
    result.articlesSeen += items.length;

    for (const item of items) {
      const text = `${item.headline}\n${item.summary}`;
      const indicatorMatches = findIndicatorMatches(text, indicators);
      if (indicatorMatches.length === 0) continue;
      const brand = extractBrand(text, brandExtractors);

      const inserted = await db
        .insert(articles)
        .values({
          url: item.url,
          outlet: feed.name,
          headline: item.headline,
          summary: item.summary,
          brand,
          publishedAt: item.publishedAt,
        })
        .onConflictDoNothing({ target: articles.url })
        .returning({ id: articles.id });

      let articleId: number;
      if (inserted.length > 0) {
        articleId = inserted[0].id;
        result.articlesNew += 1;
      } else {
        const existing = await db
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.url, item.url));
        if (existing.length === 0) continue;
        articleId = existing[0].id;
      }

      for (const m of indicatorMatches) {
        const ins = await db
          .insert(matches)
          .values({ articleId, patternId: m.patternId, snippet: m.snippet })
          .onConflictDoNothing({
            target: [matches.articleId, matches.patternId],
          })
          .returning({ id: matches.id });
        if (ins.length > 0) result.matchesNew += 1;
      }
    }
  }

  await db
    .update(scanRuns)
    .set({
      finishedAt: new Date(),
      feedsScanned: result.feedsScanned,
      articlesSeen: result.articlesSeen,
      articlesNew: result.articlesNew,
      matchesNew: result.matchesNew,
      error: result.errors.length > 0 ? JSON.stringify(result.errors).slice(0, 4000) : null,
    })
    .where(eq(scanRuns.id, run.id));

  return result;
}

// CLI entrypoint when invoked via `tsx lib/scanner/run.ts`
const isCli = process.argv[1] && process.argv[1].endsWith("run.ts");
if (isCli) {
  runScan()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

