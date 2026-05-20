// Candidate feeds for the next round of expansion: major UK regional
// dailies covering every region. Each is probed via fetchFeed at
// /admin/feeds-import before being inserted into the feeds table —
// nothing here goes into the DB without validation.
//
// Patterns expected by publisher:
//   Reach plc                  https://www.[outlet]/?service=rss
//   National World / JPIMedia  https://www.[outlet]/news/rss
//   Newsquest                  https://www.[outlet]/feed/?type=rss or /news/rss/
//   Independent / others       /feed/ or /rss
//
// Existing regional feeds already in SEED_FEEDS (don't duplicate):
//   Manchester Evening News, Liverpool Echo, Birmingham Live,
//   Evening Standard, Yorkshire Post, Belfast Telegraph
export const FEED_CANDIDATES: { name: string; url: string; tier: string }[] = [
  // North East England
  { name: "ChronicleLive (Newcastle)", url: "https://www.chroniclelive.co.uk/?service=rss", tier: "regional" },
  { name: "The Northern Echo", url: "https://www.thenorthernecho.co.uk/news/rss/", tier: "regional" },

  // Yorkshire & Humber
  { name: "Hull Live", url: "https://www.hulldailymail.co.uk/?service=rss", tier: "regional" },
  { name: "Leeds Live", url: "https://www.leeds-live.co.uk/?service=rss", tier: "regional" },
  { name: "The Star (Sheffield)", url: "https://www.thestar.co.uk/news/rss", tier: "regional" },
  { name: "Yorkshire Evening Post", url: "https://www.yorkshireeveningpost.co.uk/news/rss", tier: "regional" },

  // North West England
  { name: "Lancashire Post", url: "https://www.lep.co.uk/news/rss", tier: "regional" },
  { name: "Lancashire Live", url: "https://www.lancs.live/?service=rss", tier: "regional" },

  // East Midlands
  { name: "Nottinghamshire Live", url: "https://www.nottinghampost.com/?service=rss", tier: "regional" },
  { name: "Leicestershire Live", url: "https://www.leicestermercury.co.uk/?service=rss", tier: "regional" },

  // West Midlands
  { name: "Coventry Live", url: "https://www.coventrytelegraph.net/?service=rss", tier: "regional" },
  { name: "Express & Star (Black Country)", url: "https://www.expressandstar.com/feed/", tier: "regional" },
  { name: "Stoke Sentinel", url: "https://www.stokesentinel.co.uk/?service=rss", tier: "regional" },

  // South East England
  { name: "The Argus (Brighton)", url: "https://www.theargus.co.uk/news/rss/", tier: "regional" },
  { name: "The News (Portsmouth)", url: "https://www.portsmouth.co.uk/news/rss", tier: "regional" },

  // South West England
  { name: "Bristol Live", url: "https://www.bristolpost.co.uk/?service=rss", tier: "regional" },
  { name: "Plymouth Live", url: "https://www.plymouthherald.co.uk/?service=rss", tier: "regional" },
  { name: "Devon Live", url: "https://www.devonlive.com/?service=rss", tier: "regional" },
  { name: "Cornwall Live", url: "https://www.cornwalllive.com/?service=rss", tier: "regional" },

  // Wales
  { name: "Wales Online", url: "https://www.walesonline.co.uk/?service=rss", tier: "regional" },
  { name: "North Wales Live", url: "https://www.dailypost.co.uk/?service=rss", tier: "regional" },

  // Scotland
  { name: "The Scotsman", url: "https://www.scotsman.com/news/rss", tier: "regional" },
  { name: "Edinburgh Evening News", url: "https://www.edinburghnews.scotsman.com/news/rss", tier: "regional" },
  { name: "Herald Scotland", url: "https://www.heraldscotland.com/news/rss/", tier: "regional" },

  // Northern Ireland
  { name: "Belfast Live", url: "https://www.belfastlive.co.uk/?service=rss", tier: "regional" },
];
