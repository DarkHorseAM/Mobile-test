// Candidate feeds proposed for the feed-list expansion. Documented URL
// patterns from publisher CMSes (Reach plc, Hearst UK, Future plc, Condé
// Nast, Mediahuis, WordPress). Each one is probed via fetchFeed at
// /admin/feeds-import before being inserted into the feeds table —
// nothing here goes into the DB without validation.
//
// Excluded from this list because the agent couldn't find a public RSS:
//   MSN UK              — Microsoft only exposes a partner-ingestion API
//   Refinery29 UK       — UK ops shut down Sep 2025
//   Heat / Closer       — Bauer Media, no public RSS endpoint
//
// Excluded because the URL already exists in SEED_FEEDS:
//   The i Paper         — inews.co.uk/feed is already seeded as "i News"
//   Manchester Evening  — already seeded
export const FEED_CANDIDATES: { name: string; url: string; tier: string }[] = [
  // National gap-fillers
  { name: "Daily Star", url: "https://www.dailystar.co.uk/?service=rss", tier: "tabloid" },
  { name: "Daily Record", url: "https://www.dailyrecord.co.uk/news/?service=rss", tier: "tabloid" },
  { name: "HuffPost UK", url: "https://www.huffingtonpost.co.uk/feeds/index.xml", tier: "broadsheet" },
  { name: "Yahoo News UK", url: "https://uk.news.yahoo.com/rss", tier: "broadsheet" },
  { name: "Yorkshire Post", url: "https://www.yorkshirepost.co.uk/news/rss", tier: "regional" },
  { name: "Belfast Telegraph", url: "https://www.belfasttelegraph.co.uk/news/rss/", tier: "regional" },

  // Lifestyle / vertical
  { name: "Tyla", url: "https://www.tyla.com/rss", tier: "lifestyle" },
  { name: "LADbible", url: "https://www.ladbible.com/rss", tier: "lifestyle" },
  { name: "Cosmopolitan UK", url: "https://www.cosmopolitan.com/uk/rss/all.xml/", tier: "lifestyle" },
  { name: "GoodtoKnow", url: "https://www.goodto.com/feed", tier: "lifestyle" },
  { name: "Stylist", url: "https://www.stylist.co.uk/feed", tier: "lifestyle" },
  { name: "Bustle UK", url: "https://www.bustle.com/rss", tier: "lifestyle" },
  { name: "House Beautiful UK", url: "https://www.housebeautiful.com/uk/rss/all.xml/", tier: "lifestyle" },
  { name: "Time Out London", url: "https://www.timeout.com/london/blog/feed.rss", tier: "lifestyle" },
  { name: "Hello! Magazine", url: "https://www.hellomagazine.com/rss.xml", tier: "lifestyle" },
  { name: "OK! Magazine", url: "https://www.ok.co.uk/?service=rss", tier: "lifestyle" },
  { name: "Glamour UK", url: "https://www.glamourmagazine.co.uk/feed/rss", tier: "lifestyle" },
  { name: "Marie Claire UK", url: "https://www.marieclaire.co.uk/feeds.xml", tier: "lifestyle" },
  { name: "Red Magazine", url: "https://www.redonline.co.uk/rss/all.xml/", tier: "lifestyle" },
  { name: "Woman & Home", url: "https://www.womanandhome.com/feed", tier: "lifestyle" },
  { name: "Delish UK", url: "https://www.delish.com/uk/rss/all.xml/", tier: "lifestyle" },
  { name: "Country Living UK", url: "https://www.countryliving.com/uk/rss/all.xml/", tier: "lifestyle" },
  { name: "Good Housekeeping UK", url: "https://www.goodhousekeeping.com/uk/rss/all.xml/", tier: "lifestyle" },
  { name: "Ideal Home", url: "https://www.idealhome.co.uk/feed", tier: "lifestyle" },
  { name: "Real Homes", url: "https://www.realhomes.com/feed", tier: "lifestyle" },
  { name: "Digital Spy", url: "https://www.digitalspy.com/rss/default.xml", tier: "lifestyle" },
  { name: "The Tab", url: "https://thetab.com/feed/", tier: "lifestyle" },
];
