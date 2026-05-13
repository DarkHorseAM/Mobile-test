import { db } from "./client";
import { feeds, patterns } from "./schema";
import { SEED_FEEDS, SEED_INDICATORS, SEED_BRAND_EXTRACTORS } from "./seed-data";
import { sql } from "drizzle-orm";

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

  console.log("Seeding brand extractors...");
  for (const p of SEED_BRAND_EXTRACTORS) {
    await db
      .insert(patterns)
      .values({ slug: p.slug, label: p.label, regex: p.regex, kind: "brand" })
      .onConflictDoNothing({ target: patterns.slug });
  }

  const feedRows = await db.select({ c: sql<number>`count(*)::int` }).from(feeds);
  const patternRows = await db.select({ c: sql<number>`count(*)::int` }).from(patterns);
  console.log(`Done. ${feedRows[0]?.c ?? 0} feeds, ${patternRows[0]?.c ?? 0} patterns.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
