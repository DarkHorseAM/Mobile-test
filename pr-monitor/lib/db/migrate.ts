import { db } from "./client";
import { sql } from "drizzle-orm";
import { SEED_URL_BLOCKLIST, RETIRED_PATTERN_SLUGS } from "./seed-data";

async function main() {
  console.log("1/4  ALTER articles ADD COLUMN confidence_score ...");
  await db.execute(
    sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS confidence_score INTEGER NOT NULL DEFAULT 0`,
  );

  console.log("2/4  CREATE TABLE url_blocklist ...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS url_blocklist (
      id         SERIAL PRIMARY KEY,
      fragment   TEXT NOT NULL UNIQUE,
      is_active  BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log("3/4  Seed default blocklist fragments ...");
  for (const fragment of SEED_URL_BLOCKLIST) {
    await db.execute(
      sql`INSERT INTO url_blocklist (fragment) VALUES (${fragment}) ON CONFLICT (fragment) DO NOTHING`,
    );
  }

  console.log("4/4  Deactivate retired patterns ...");
  for (const slug of RETIRED_PATTERN_SLUGS) {
    await db.execute(sql`UPDATE patterns SET is_active = FALSE WHERE slug = ${slug}`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
