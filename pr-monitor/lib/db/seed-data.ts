export const SEED_FEEDS: { name: string; url: string; tier: string }[] = [
  // National tabloids
  { name: "Daily Mail", url: "https://www.dailymail.co.uk/articles.rss", tier: "tabloid" },
  { name: "The Sun", url: "https://www.thesun.co.uk/feed/", tier: "tabloid" },
  { name: "Daily Mirror", url: "https://www.mirror.co.uk/?service=rss", tier: "tabloid" },
  { name: "Daily Express", url: "https://www.express.co.uk/posts/rss/1", tier: "tabloid" },
  { name: "Metro", url: "https://metro.co.uk/feed/", tier: "tabloid" },
  { name: "Daily Star", url: "https://www.dailystar.co.uk/?service=rss", tier: "tabloid" },

  // National broadsheets
  { name: "The Guardian", url: "https://www.theguardian.com/uk/rss", tier: "broadsheet" },
  { name: "The Independent", url: "https://www.independent.co.uk/news/uk/rss", tier: "broadsheet" },
  { name: "i News", url: "https://inews.co.uk/feed", tier: "broadsheet" },
  { name: "Financial Times (UK)", url: "https://www.ft.com/rss/uk", tier: "broadsheet" },

  // Broadcasters
  { name: "BBC News (UK)", url: "https://feeds.bbci.co.uk/news/uk/rss.xml", tier: "broadcaster" },
  { name: "BBC News (Business)", url: "https://feeds.bbci.co.uk/news/business/rss.xml", tier: "broadcaster" },
  { name: "Sky News (UK)", url: "https://feeds.skynews.com/feeds/rss/uk.xml", tier: "broadcaster" },
  { name: "ITV News", url: "https://www.itv.com/news/index.rss", tier: "broadcaster" },

  // Regional / lifestyle
  { name: "Manchester Evening News", url: "https://www.manchestereveningnews.co.uk/?service=rss", tier: "regional" },
  { name: "Liverpool Echo", url: "https://www.liverpoolecho.co.uk/?service=rss", tier: "regional" },
  { name: "Birmingham Live", url: "https://www.birminghammail.co.uk/?service=rss", tier: "regional" },
  { name: "Evening Standard", url: "https://www.standard.co.uk/rss", tier: "regional" },
];

export const SEED_INDICATORS: { slug: string; label: string; regex: string }[] = [
  // Survey / research framing
  { slug: "research_by", label: "Research by [brand]", regex: "\\baccording to (?:new |recent |fresh )?research(?: by)?\\b" },
  { slug: "study_by", label: "Study by [brand]", regex: "\\b(?:a |new )?stud(?:y|ies) (?:by|from|conducted by)\\b" },
  { slug: "new_study", label: "A new study", regex: "\\ba new study\\b" },
  { slug: "survey_finds", label: "Survey finds", regex: "\\b(?:survey|poll|research) (?:finds|reveals|shows|suggests|claims|warns)\\b" },
  { slug: "data_reveals", label: "Data reveals", regex: "\\bdata (?:reveals|shows|suggests|finds)\\b" },
  { slug: "report_finds", label: "Report finds", regex: "\\b(?:a |new |latest )?report (?:finds|reveals|shows|claims)\\b" },
  { slug: "experts_say", label: "Experts say / warn", regex: "\\bexperts? (?:say|warn|reveal|claim)\\b" },
  { slug: "scientists_reveal", label: "Scientists reveal", regex: "\\bscientists? (?:say|reveal|warn|claim|find)\\b" },

  // "% of Brits" style stat hooks
  { slug: "percent_of_brits", label: "% of Brits", regex: "\\b\\d{1,3}\\s?%(?:[^\\n]{0,30})\\b(?:brits|britons|adults|people|uk(?:ers)?|parents|workers|women|men)\\b" },
  { slug: "x_in_y", label: "X in Y (e.g. 1 in 5)", regex: "\\b\\d{1,2} in \\d{1,2}\\b" },
  { slug: "average_brit", label: "Average Brit", regex: "\\bthe average (?:brit|briton|adult|person|uk\\b)" },

  // Ranked / named / superlative listicles
  { slug: "ranked", label: "Ranked", regex: "\\b(?:ranked|ranking)\\b" },
  { slug: "named_most", label: "Named the most/least", regex: "\\bnamed (?:the )?(?:most|least|best|worst)\\b" },
  { slug: "revealed_best_worst", label: "Revealed: best/worst", regex: "\\brevealed[:\\s].{0,40}\\b(?:best|worst|top|bottom|most|least)\\b" },
  { slug: "top_n", label: "Top N list", regex: "\\btop \\d{1,3}\\b" },
  { slug: "cheapest_most_expensive", label: "Cheapest / most expensive", regex: "\\b(?:cheapest|most expensive|priciest|most affordable)\\b" },
  { slug: "happiest_unhappiest", label: "Happiest / unhappiest", regex: "\\b(?:happiest|unhappiest|loneliest|friendliest|rudest|politest)\\b" },

  // Time / location framing common in PR
  { slug: "best_place_to", label: "Best place to...", regex: "\\bbest (?:place|city|town|country|street|postcode) (?:to|for|in)\\b" },
  { slug: "most_y_for_z", label: "Most Y for Z", regex: "\\b(?:the )?most \\w+ (?:place|city|town|country|area|street) (?:to|for|in)\\b" },

  // Money / cost-of-living framing
  { slug: "costs_uk_average", label: "Average cost / spend", regex: "\\b(?:the )?average (?:cost|spend|salary|earnings|household)\\b" },
  { slug: "how_much_save", label: "How much you could save", regex: "\\bhow much (?:you could|brits|britons|households) (?:save|spend|earn|pay)\\b" },

  // Trend / Google search hooks
  { slug: "google_searches", label: "Google searches", regex: "\\b(?:google )?searches? (?:for|spike|surge|jump|up)\\b" },
  { slug: "tiktok_trend", label: "TikTok / viral trend", regex: "\\b(?:tiktok|viral) (?:trend|hack|recipe|craze)\\b" },
];

// Slugs of patterns that used to ship in seed but have been retired. The
// seed script deactivates these instead of deleting them so historical
// matches stay readable in the UI.
export const RETIRED_PATTERN_SLUGS: string[] = ["this_summer_winter"];

export const SEED_URL_BLOCKLIST: string[] = [
  "/sport/",
  "/football/",
  "/sport/football/",
  "/cricket/",
  "/rugby/",
  "/tennis/",
];

// Brand extractors — each must have exactly one capture group, first match wins.
export const SEED_BRAND_EXTRACTORS: { slug: string; label: string; regex: string }[] = [
  { slug: "research_by_brand", label: "research by X", regex: "\\baccording to (?:new |recent |fresh )?research (?:by|from|conducted by)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\\b|$)" },
  { slug: "study_by_brand", label: "study by X", regex: "\\b(?:a |new )?stud(?:y|ies) (?:by|from|conducted by)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\\b|$)" },
  { slug: "survey_by_brand", label: "survey by X", regex: "\\b(?:a |new )?(?:survey|poll) (?:by|from|conducted by|commissioned by)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\\b|$)" },
  { slug: "data_from_brand", label: "data from X", regex: "\\b(?:data|figures|analysis) (?:from|by)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\\b|$)" },
  { slug: "experts_at_brand", label: "experts at X", regex: "\\bexperts? (?:at|from)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:say|said|warn|warned|reveal|revealed|claim|claimed)\\b|$)" },
  { slug: "report_by_brand", label: "report by X", regex: "\\b(?:a |new |latest )?report (?:by|from|published by|commissioned by)\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|\\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\\b|$)" },
  { slug: "commissioned_by_brand", label: "commissioned by X", regex: "\\bcommissioned by\\s+([A-Z][\\w&.'’\\- ]{2,60}?)(?=[\\.,;:]|$)" },
];
