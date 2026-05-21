// Google News RSS fallback feeds for outlets whose direct RSS endpoints
// fail. Trade-off: Google News only ships the headline + a wrapped link
// in the description, so pattern matching is weaker than on direct feeds
// (no article lede to scan). Acceptable as a fallback to recover some
// coverage from major outlets we'd otherwise have none of.
//
// After Apply, also disable the corresponding direct-URL rows in
// /config/feeds: Daily Mirror, Daily Star, Manchester Evening News,
// Liverpool Echo, Birmingham Live, ITV News.
export const FEED_CANDIDATES: { name: string; url: string; tier: string }[] = [
  { name: "Daily Mirror (via Google News)", url: "https://news.google.com/rss/search?q=site:mirror.co.uk&hl=en-GB&gl=GB&ceid=GB:en", tier: "tabloid" },
  { name: "Daily Star (via Google News)", url: "https://news.google.com/rss/search?q=site:dailystar.co.uk&hl=en-GB&gl=GB&ceid=GB:en", tier: "tabloid" },
  { name: "Manchester Evening News (via Google News)", url: "https://news.google.com/rss/search?q=site:manchestereveningnews.co.uk&hl=en-GB&gl=GB&ceid=GB:en", tier: "regional" },
  { name: "Liverpool Echo (via Google News)", url: "https://news.google.com/rss/search?q=site:liverpoolecho.co.uk&hl=en-GB&gl=GB&ceid=GB:en", tier: "regional" },
  { name: "Birmingham Live (via Google News)", url: "https://news.google.com/rss/search?q=site:birminghammail.co.uk&hl=en-GB&gl=GB&ceid=GB:en", tier: "regional" },
  { name: "ITV News (via Google News)", url: "https://news.google.com/rss/search?q=site:itv.com/news&hl=en-GB&gl=GB&ceid=GB:en", tier: "broadcaster" },
];
