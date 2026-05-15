import Parser from "rss-parser";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type FetchedItem = {
  url: string;
  headline: string;
  summary: string;
  publishedAt: Date | null;
};

function parserFor(url: string): Parser {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  };

  // Telegraph blocks server-side fetches without a browser UA + Referer.
  if (/telegraph\.co\.uk/i.test(url)) {
    headers["Referer"] = "https://www.telegraph.co.uk/";
  }

  // ITV's RSS endpoint regularly takes longer than the default budget.
  const timeout = /itv\.com/i.test(url) ? 30000 : 15000;

  return new Parser({ timeout, headers });
}

export async function fetchFeed(url: string): Promise<FetchedItem[]> {
  const feed = await parserFor(url).parseURL(url);
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
