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
  kind: text("kind").notNull().default("indicator"), // "indicator" | "brand"
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
    brand: text("brand"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => ({
    urlIdx: uniqueIndex("articles_url_idx").on(t.url),
    publishedIdx: index("articles_published_idx").on(t.publishedAt),
    outletIdx: index("articles_outlet_idx").on(t.outlet),
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

// Auth.js v5 tables
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable("accounts", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => ({
  pk: uniqueIndex("accounts_pk").on(t.provider, t.providerAccountId),
}));

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verificationTokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => ({
  pk: uniqueIndex("vt_pk").on(t.identifier, t.token),
}));

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Pattern = typeof patterns.$inferSelect;
export type Feed = typeof feeds.$inferSelect;
export type Match = typeof matches.$inferSelect;
