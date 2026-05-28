import Parser from "rss-parser";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type FetchedItem = {
  url: string;
  headline: string;
  summary: string;
  publishedAt: Date | null;
  byline: string | null;
};

function normaliseByline(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/^\s*by\s+/i, "")
    .trim();
  if (!cleaned) return null;
  // Some outlets fill creator with the outlet name itself ("Daily Mail",
  // "The Guardian"). Skip values that look like a section / outlet
  // rather than a person.
  if (/^[a-z ]+@[a-z.]+$/i.test(cleaned)) return null; // bare email
  return cleaned.slice(0, 200);
}

function parserFor(url: string): Parser {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
  };

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
      const rawByline =
        (item as Record<string, unknown>)["dc:creator"]?.toString() ||
        item.creator ||
        (typeof item.author === "string" ? item.author : undefined);
      return {
        url: link,
        headline: (item.title ?? "").trim().slice(0, 500),
        summary,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
        byline: normaliseByline(rawByline),
      } satisfies FetchedItem;
    })
    .filter((x): x is FetchedItem => x !== null && x.headline.length > 0);
}
