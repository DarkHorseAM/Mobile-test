import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const feeds = pgTable("feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  tier: text("tier"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patterns = pgTable("patterns", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  regex: text("regex").notNull(),
  kind: text("kind").notNull().default("indicator"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull(),
    outlet: text("outlet").notNull(),
    headline: text("headline").notNull(),
    summary: text("summary").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean("hidden").notNull().default(false),
    verifiedPr: boolean("verified_pr"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
  },
  (t) => ({
    urlIdx: uniqueIndex("articles_url_idx").on(t.url),
    publishedIdx: index("articles_published_idx").on(t.publishedAt),
    outletIdx: index("articles_outlet_idx").on(t.outlet),
    verifiedIdx: index("articles_verified_idx").on(t.verifiedPr),
  }),
);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    patternId: integer("pattern_id")
      .notNull()
      .references(() => patterns.id, { onDelete: "cascade" }),
    snippet: text("snippet").notNull().default(""),
  },
  (t) => ({
    uniqArticlePattern: uniqueIndex("matches_article_pattern_idx").on(
      t.articleId,
      t.patternId,
    ),
    patternIdx: index("matches_pattern_idx").on(t.patternId),
  }),
);

export const urlBlocklist = pgTable("url_blocklist", {
  id: serial("id").primaryKey(),
  fragment: text("fragment").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scanRuns = pgTable("scan_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  feedsScanned: integer("feeds_scanned").notNull().default(0),
  articlesSeen: integer("articles_seen").notNull().default(0),
  articlesNew: integer("articles_new").notNull().default(0),
  matchesNew: integer("matches_new").notNull().default(0),
  error: text("error"),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Pattern = typeof patterns.$inferSelect;
export type Feed = typeof feeds.$inferSelect;
export type Match = typeof matches.$inferSelect;
