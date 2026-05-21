// Alternate Reach plc URL patterns to test after the publisher blocked
// our existing ?service=rss endpoints. Daily Express and Metro (both
// Reach plc) work fine with /posts/rss/1 and /feed/ respectively, so
// /feed/ is the most-likely-to-work pattern across the rest of their
// network.
//
// Re-probe at /admin/feeds-import, then click Apply. The "old" failing
// URLs (e.g. mirror.co.uk/?service=rss) stay in the DB unless you also
// disable them via /config/feeds — they won't conflict because the URL
// is different.
export const FEED_CANDIDATES: { name: string; url: string; tier: string }[] = [
  { name: "Daily Mirror", url: "https://www.mirror.co.uk/feed/", tier: "tabloid" },
  { name: "Daily Star", url: "https://www.dailystar.co.uk/feed/", tier: "tabloid" },
  { name: "Manchester Evening News", url: "https://www.manchestereveningnews.co.uk/feed/", tier: "regional" },
  { name: "Liverpool Echo", url: "https://www.liverpoolecho.co.uk/feed/", tier: "regional" },
  { name: "Birmingham Live", url: "https://www.birminghammail.co.uk/feed/", tier: "regional" },
];
