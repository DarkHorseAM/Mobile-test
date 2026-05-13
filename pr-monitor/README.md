# PR Campaign Monitor

A web app that scans UK news outlets for likely PR-originated coverage, surfaces
recurring angles and brand attributions, and helps a digital PR team spot
campaign inspiration.

Built on Next.js 15 + Drizzle ORM + Neon Postgres, deployed on Vercel with a
cron-triggered hourly scan.

## Features

- **Hourly scan** of configurable UK RSS feeds (Vercel Cron)
- **Pattern matching** with editable regex indicators (e.g. "% of Brits",
  "ranked", "according to research by")
- **Brand extraction** from phrases like "a study by X" via regex with a
  single capture group
- **Browse** — filter by date / outlet / pattern / brand, full-text search,
  CSV export
- **Trends** — top brands, top patterns, top outlets, this-week-vs-last
  pattern deltas, headline word frequencies
- **Config UI** — add/disable feeds and patterns without touching code
- **Team-only auth** via Auth.js v5: email magic-link (Resend) and/or
  Google OAuth, gated by an email allowlist

## Stack

| Layer       | Tech                                |
| ----------- | ----------------------------------- |
| Framework   | Next.js 15 (App Router, TypeScript) |
| Database    | Neon (serverless Postgres)          |
| ORM         | Drizzle + drizzle-kit               |
| Auth        | Auth.js v5 with Drizzle adapter     |
| Scheduling  | Vercel Cron                         |
| RSS         | rss-parser                          |
| UI          | Tailwind CSS + small in-house components |

## Setup

### 1. Install

```bash
cd pr-monitor
npm install
```

### 2. Create a Neon database

Free tier is fine. Copy the pooled connection string into `.env.local`:

```bash
cp .env.example .env.local
# then fill in DATABASE_URL
```

### 3. Push the schema and seed

```bash
npm run db:push      # creates tables in Neon
npm run db:seed      # inserts ~20 UK feeds and ~30 patterns
```

### 4. Configure auth

In `.env.local`, set `AUTH_SECRET` (`openssl rand -base64 32`) and **at least
one** of:

- `AUTH_RESEND_KEY` + `AUTH_EMAIL_FROM` — email magic-link via Resend
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` — Google OAuth

Restrict access by listing emails in `ALLOWED_EMAILS` (comma-separated).
Leave it blank and *anyone* who can authenticate is in — fine for a
private staging deploy, not for production.

### 5. Run locally

```bash
npm run dev
```

Visit <http://localhost:3000>, sign in, and click **Run scan now** on the
Browse page.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import into Vercel.
3. Add the same env vars from `.env.local` in the project settings. Also set
   `AUTH_URL` to the deployed URL.
4. Generate a `CRON_SECRET` and add it. Vercel Cron will automatically include
   `Authorization: Bearer <CRON_SECRET>` on scheduled requests.
5. Deploy. The cron in `vercel.json` runs `/api/scan` every hour on the hour.

## Daily-use workflow

1. The hourly cron pulls articles from each active feed in `feeds`.
2. For each article: headline + summary are tested against every active
   `indicator` pattern. If at least one matches, the article is stored.
3. Brand extractors are applied to the same text; the first capturing match
   wins and is stored on the article row.
4. The Browse page shows what was found; Trends shows what's spiking.
5. Tune the patterns at `/config/patterns` and the feeds at `/config/feeds`
   as your taste in PR-indicator phrases sharpens.

## Database

Schema in `lib/db/schema.ts`. Tables:

- `feeds`, `patterns` — config
- `articles` — one row per unique URL (`hidden` flag for soft-delete)
- `matches` — article × pattern (unique pair)
- `scan_runs` — debug history of each scan
- `users`, `accounts`, `sessions`, `verificationTokens` — Auth.js

## Notes on false positives

The brief flagged that pattern matching will catch genuine academic citations
as well as PR pitches. The schema includes a `hidden` boolean on `articles`
so you can soft-delete obvious editorial coverage; an "Ignore brand"
allowlist is a sensible next step but isn't in v1.

## Out of scope for v1

- Full-article scraping
- Sentiment / ML classification
- Social listening
- Tracking the user's own owned campaigns
