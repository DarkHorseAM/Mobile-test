import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });

export type FetchedItem = {
  url: string;
  headline: string;
  summary: string;
  publishedAt: Date | null;
};

export async function fetchFeed(url: string): Promise<FetchedItem[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? [])
    .map((item) => {
      const link = (item.link ?? item.guid ?? "").trim();
      if (!link) return null;
      const summary =
        (item.contentSnippet || item.content || (item as Record<string, unknown>).summary || "")
          .toString()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 4000);
      const dateRaw = item.isoDate || item.pubDate;
      const publishedAt = dateRaw ? new Date(dateRaw) : null;
      return {
        url: link,
        headline: (item.title ?? "").trim().slice(0, 500),
        summary,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      } satisfies FetchedItem;
    })
    .filter((x): x is FetchedItem => x !== null && x.headline.length > 0);
}
