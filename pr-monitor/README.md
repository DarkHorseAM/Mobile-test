# PR Campaign Monitor

A tool for digital PR professionals to scan UK news outlets, surface
PR-originated coverage (surveys, "ranked" lists, "% of Brits" stats, expert
quotes, etc.), and spot recurring angles, formats and named brands so the user
can find inspiration for new campaigns.

This is **v1** — RSS-only, SQLite-backed, run on-demand or via cron, with a
Streamlit UI.

## What it does

1. Pulls articles from a configurable list of UK news RSS feeds.
2. Runs each headline + RSS summary through a configurable set of regex
   patterns that indicate PR origin (e.g. "according to research by",
   "a new study", "% of Brits", "named the most…", "ranked").
3. Tries to extract the named brand/source after phrases like
   "research by X" or "study from Y".
4. Stores everything in a local SQLite database, deduped by URL.
5. Exposes a Streamlit UI with a **Browse** tab (filter, sort, export to CSV)
   and a **Trends** tab (top brands, top patterns, top outlets, this-week vs
   last-week deltas, headline word frequencies).

## Project layout

```
pr-monitor/
├── config/
│   ├── feeds.yaml          # RSS feeds to scan (user-editable)
│   └── patterns.yaml       # PR-indicator phrases + brand-extraction regex
├── pr_monitor/
│   ├── __init__.py
│   ├── scanner.py          # fetch + match + store
│   ├── db.py               # SQLite schema and queries
│   └── app.py              # Streamlit UI
├── data/
│   └── monitor.db          # created on first scan (git-ignored)
├── requirements.txt
└── README.md
```

## Install

```bash
cd pr-monitor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run a scan

```bash
# default: reads config/feeds.yaml, config/patterns.yaml, writes data/monitor.db
python -m pr_monitor.scanner

# with overrides
python -m pr_monitor.scanner \
    --feeds config/feeds.yaml \
    --patterns config/patterns.yaml \
    --db data/monitor.db \
    -v
```

### Scheduling via cron

A scan every 30 minutes:

```cron
*/30 * * * * cd /path/to/pr-monitor && /path/to/.venv/bin/python -m pr_monitor.scanner >> data/scanner.log 2>&1
```

The scanner is safe to run repeatedly — articles are deduped by URL and
matches are deduped by `(article, pattern)`.

## Open the UI

```bash
streamlit run pr_monitor/app.py
```

Then visit <http://localhost:8501>. The sidebar has a **Run scan now** button
if you'd rather not use cron.

### Browse tab

- Filter by date range, outlet, pattern, brand, and free-text search across
  headlines & summaries.
- Sortable table with direct links to each article.
- One-click **Export to CSV** of the filtered view.

### Trends tab

- **Top brands** — most-named research sources in the date range.
- **Top patterns** — which PR framings are getting the most coverage.
- **Top outlets** — who's running the most PR-shaped pieces.
- **This week vs last week** — pattern-level deltas to catch what's spiking.
- **Headline word frequencies** — quick view of recurring nouns and themes.

## Customising

### Feeds

Edit `config/feeds.yaml`. Each entry needs a `name` and `url`; `tier` is
optional metadata stored alongside each article.

```yaml
feeds:
  - name: Your Local Paper
    url: https://example.co.uk/rss
    tier: regional
```

### Patterns

Edit `config/patterns.yaml`. Two sections:

- `indicators` — regex applied to `headline + summary`. Each match is stored
  with a snippet of context. Patterns are case-insensitive.
- `brand_extractors` — regex with one capture group; the group's value is
  stored as the article's `brand`. The first matching extractor wins.

Restart the Streamlit app (or re-run the scanner) after changing patterns.

## Database

SQLite, at `data/monitor.db`. Three tables:

- `articles` — one row per unique URL.
- `matches` — one row per `(article_id, pattern_id)`.
- `scan_runs` — history of scans for debugging and "last scan" display.

Use any SQLite client (`sqlite3 data/monitor.db`) for ad-hoc queries.

## Limitations (v1)

- RSS only — no full-article scraping. Some outlets' RSS summaries are
  truncated, so subtle PR framing may slip past pattern matching.
- No sentiment, no NLP classification.
- No link metrics or SEO data.
- No tracking of campaigns the user owns (planned for a later mode).
- No social media monitoring.

## Roadmap

- Optional full-article fetch for outlets with thin summaries.
- "My campaigns" mode — flag articles that mention a user-supplied brand.
- Smarter brand extraction (NER) once the regex hit-rate plateaus.
- Email/Slack digest of weekly highlights.
