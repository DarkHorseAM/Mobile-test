import { db } from "./client";
import { feeds, patterns, urlBlocklist } from "./schema";
import {
  SEED_FEEDS,
  SEED_INDICATORS,
  SEED_URL_BLOCKLIST,
  RETIRED_PATTERN_SLUGS,
} from "./seed-data";
import { sql, eq } from "drizzle-orm";

async function main() {
  console.log("Seeding feeds...");
  for (const f of SEED_FEEDS) {
    await db
      .insert(feeds)
      .values({ name: f.name, url: f.url, tier: f.tier })
      .onConflictDoNothing({ target: feeds.url });
  }

  console.log("Seeding indicator patterns...");
  for (const p of SEED_INDICATORS) {
    await db
      .insert(patterns)
      .values({ slug: p.slug, label: p.label, regex: p.regex, kind: "indicator" })
      .onConflictDoNothing({ target: patterns.slug });
  }

  console.log("Deactivating retired patterns...");
  for (const slug of RETIRED_PATTERN_SLUGS) {
    await db.update(patterns).set({ isActive: false }).where(eq(patterns.slug, slug));
  }

  console.log("Seeding URL blocklist...");
  for (const fragment of SEED_URL_BLOCKLIST) {
    await db
      .insert(urlBlocklist)
      .values({ fragment })
      .onConflictDoNothing({ target: urlBlocklist.fragment });
  }

  const feedRows = await db.select({ c: sql<number>`count(*)::int` }).from(feeds);
  const patternRows = await db.select({ c: sql<number>`count(*)::int` }).from(patterns);
  const blockRows = await db.select({ c: sql<number>`count(*)::int` }).from(urlBlocklist);
  console.log(
    `Done. ${feedRows[0]?.c ?? 0} feeds, ${patternRows[0]?.c ?? 0} patterns, ${blockRows[0]?.c ?? 0} blocklist fragments.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
