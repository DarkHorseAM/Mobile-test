-- Seed feeds + patterns. Safe to re-run; uses ON CONFLICT DO NOTHING.

-- Feeds
INSERT INTO feeds (name, url, tier) VALUES
  ('Daily Mail', 'https://www.dailymail.co.uk/articles.rss', 'tabloid'),
  ('The Sun', 'https://www.thesun.co.uk/feed/', 'tabloid'),
  ('Daily Mirror', 'https://www.mirror.co.uk/?service=rss', 'tabloid'),
  ('Daily Express', 'https://www.express.co.uk/posts/rss/1', 'tabloid'),
  ('Metro', 'https://metro.co.uk/feed/', 'tabloid'),
  ('Daily Star', 'https://www.dailystar.co.uk/?service=rss', 'tabloid'),
  ('The Guardian', 'https://www.theguardian.com/uk/rss', 'broadsheet'),
  ('The Telegraph', 'https://www.telegraph.co.uk/rss.xml', 'broadsheet'),
  ('The Times', 'https://www.thetimes.co.uk/rss', 'broadsheet'),
  ('The Independent', 'https://www.independent.co.uk/news/uk/rss', 'broadsheet'),
  ('i News', 'https://inews.co.uk/feed', 'broadsheet'),
  ('Financial Times (UK)', 'https://www.ft.com/rss/uk', 'broadsheet'),
  ('BBC News (UK)', 'https://feeds.bbci.co.uk/news/uk/rss.xml', 'broadcaster'),
  ('BBC News (Business)', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'broadcaster'),
  ('Sky News (UK)', 'https://feeds.skynews.com/feeds/rss/uk.xml', 'broadcaster'),
  ('ITV News', 'https://www.itv.com/news/index.rss', 'broadcaster'),
  ('Manchester Evening News', 'https://www.manchestereveningnews.co.uk/?service=rss', 'regional'),
  ('Liverpool Echo', 'https://www.liverpoolecho.co.uk/?service=rss', 'regional'),
  ('Birmingham Live', 'https://www.birminghammail.co.uk/?service=rss', 'regional'),
  ('Evening Standard', 'https://www.standard.co.uk/rss', 'regional')
ON CONFLICT (url) DO NOTHING;

-- Indicator patterns
INSERT INTO patterns (slug, label, regex, kind) VALUES
  ('research_by', 'Research by [brand]', '\baccording to (?:new |recent |fresh )?research(?: by)?\b', 'indicator'),
  ('study_by', 'Study by [brand]', '\b(?:a |new )?stud(?:y|ies) (?:by|from|conducted by)\b', 'indicator'),
  ('new_study', 'A new study', '\ba new study\b', 'indicator'),
  ('survey_finds', 'Survey finds', '\b(?:survey|poll|research) (?:finds|reveals|shows|suggests|claims|warns)\b', 'indicator'),
  ('data_reveals', 'Data reveals', '\bdata (?:reveals|shows|suggests|finds)\b', 'indicator'),
  ('report_finds', 'Report finds', '\b(?:a |new |latest )?report (?:finds|reveals|shows|claims)\b', 'indicator'),
  ('experts_say', 'Experts say / warn', '\bexperts? (?:say|warn|reveal|claim)\b', 'indicator'),
  ('scientists_reveal', 'Scientists reveal', '\bscientists? (?:say|reveal|warn|claim|find)\b', 'indicator'),
  ('percent_of_brits', '% of Brits', '\b\d{1,3}\s?%(?:[^\n]{0,30})\b(?:brits|britons|adults|people|uk(?:ers)?|parents|workers|women|men)\b', 'indicator'),
  ('x_in_y', 'X in Y (e.g. 1 in 5)', '\b\d{1,2} in \d{1,2}\b', 'indicator'),
  ('average_brit', 'Average Brit', '\bthe average (?:brit|briton|adult|person|uk\b)', 'indicator'),
  ('ranked', 'Ranked', '\b(?:ranked|ranking)\b', 'indicator'),
  ('named_most', 'Named the most/least', '\bnamed (?:the )?(?:most|least|best|worst)\b', 'indicator'),
  ('revealed_best_worst', 'Revealed: best/worst', '\brevealed[:\s].{0,40}\b(?:best|worst|top|bottom|most|least)\b', 'indicator'),
  ('top_n', 'Top N list', '\btop \d{1,3}\b', 'indicator'),
  ('cheapest_most_expensive', 'Cheapest / most expensive', '\b(?:cheapest|most expensive|priciest|most affordable)\b', 'indicator'),
  ('happiest_unhappiest', 'Happiest / unhappiest', '\b(?:happiest|unhappiest|loneliest|friendliest|rudest|politest)\b', 'indicator'),
  ('best_place_to', 'Best place to...', '\bbest (?:place|city|town|country|street|postcode) (?:to|for|in)\b', 'indicator'),
  ('most_y_for_z', 'Most Y for Z', '\b(?:the )?most \w+ (?:place|city|town|country|area|street) (?:to|for|in)\b', 'indicator'),
  ('costs_uk_average', 'Average cost / spend', '\b(?:the )?average (?:cost|spend|salary|earnings|household)\b', 'indicator'),
  ('how_much_save', 'How much you could save', '\bhow much (?:you could|brits|britons|households) (?:save|spend|earn|pay)\b', 'indicator'),
  ('google_searches', 'Google searches', '\b(?:google )?searches? (?:for|spike|surge|jump|up)\b', 'indicator'),
  ('tiktok_trend', 'TikTok / viral trend', '\b(?:tiktok|viral) (?:trend|hack|recipe|craze)\b', 'indicator'),
  ('this_summer_winter', 'Season hook', '\b(?:this|in time for) (?:summer|winter|christmas|easter|halloween|valentine''?s|black friday)\b', 'indicator')
ON CONFLICT (slug) DO NOTHING;

-- Brand extractors (capture group 1 = brand name)
INSERT INTO patterns (slug, label, regex, kind) VALUES
  ('research_by_brand', 'research by X', '\baccording to (?:new |recent |fresh )?research (?:by|from|conducted by)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\b|$)', 'brand'),
  ('study_by_brand', 'study by X', '\b(?:a |new )?stud(?:y|ies) (?:by|from|conducted by)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\b|$)', 'brand'),
  ('survey_by_brand', 'survey by X', '\b(?:a |new )?(?:survey|poll) (?:by|from|conducted by|commissioned by)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\b|$)', 'brand'),
  ('data_from_brand', 'data from X', '\b(?:data|figures|analysis) (?:from|by)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\b|$)', 'brand'),
  ('experts_at_brand', 'experts at X', '\bexperts? (?:at|from)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:say|said|warn|warned|reveal|revealed|claim|claimed)\b|$)', 'brand'),
  ('report_by_brand', 'report by X', '\b(?:a |new |latest )?report (?:by|from|published by|commissioned by)\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|\s+(?:found|finds|shows|revealed|reveals|suggests|claims|warns)\b|$)', 'brand'),
  ('commissioned_by_brand', 'commissioned by X', '\bcommissioned by\s+([A-Z][\w&.''’\- ]{2,60}?)(?=[\.,;:]|$)', 'brand')
ON CONFLICT (slug) DO NOTHING;
