import { db } from "./client";
import { sql } from "drizzle-orm";
import { SEED_URL_BLOCKLIST, RETIRED_PATTERN_SLUGS } from "./seed-data";

export type MigrationStep = { step: string; ok: boolean; error?: string };

export async function runMigration(): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];

  async function run(step: string, fn: () => Promise<void>) {
    try {
      await fn();
      steps.push({ step, ok: true });
    } catch (e) {
      steps.push({ step, ok: false, error: (e as Error).message });
    }
  }

  await run("ALTER articles ADD COLUMN confidence_score", async () => {
    await db.execute(
      sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS confidence_score INTEGER NOT NULL DEFAULT 0`,
    );
  });

  await run("CREATE TABLE url_blocklist", async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS url_blocklist (
        id         SERIAL PRIMARY KEY,
        fragment   TEXT NOT NULL UNIQUE,
        is_active  BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  });

  await run("Seed default blocklist fragments", async () => {
    for (const fragment of SEED_URL_BLOCKLIST) {
      await db.execute(
        sql`INSERT INTO url_blocklist (fragment) VALUES (${fragment}) ON CONFLICT (fragment) DO NOTHING`,
      );
    }
  });

  await run("Deactivate retired patterns", async () => {
    for (const slug of RETIRED_PATTERN_SLUGS) {
      await db.execute(sql`UPDATE patterns SET is_active = FALSE WHERE slug = ${slug}`);
    }
  });

  await run("ALTER articles DROP COLUMN confidence_score", async () => {
    await db.execute(
      sql`ALTER TABLE articles DROP COLUMN IF EXISTS confidence_score`,
    );
  });

  await run("DELETE brand-extractor patterns", async () => {
    await db.execute(sql`DELETE FROM patterns WHERE kind = 'brand'`);
  });

  await run("ALTER articles DROP COLUMN brand", async () => {
    await db.execute(sql`ALTER TABLE articles DROP COLUMN IF EXISTS brand`);
  });

  await run("ALTER articles ADD COLUMN verified_pr", async () => {
    await db.execute(
      sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS verified_pr BOOLEAN`,
    );
  });

  await run("ALTER articles ADD COLUMN verified_at", async () => {
    await db.execute(
      sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`,
    );
  });

  await run("CREATE INDEX articles_verified_idx", async () => {
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS articles_verified_idx ON articles (verified_pr)`,
    );
  });

  await run("ALTER articles ADD COLUMN byline", async () => {
    await db.execute(
      sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS byline TEXT`,
    );
  });

  await run("CREATE INDEX articles_byline_idx", async () => {
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS articles_byline_idx ON articles (byline)`,
    );
  });

  await run("ALTER articles ADD COLUMN byline_fetched_at", async () => {
    await db.execute(
      sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS byline_fetched_at TIMESTAMPTZ`,
    );
  });

  return steps;
}

const isCli = process.argv[1] && process.argv[1].endsWith("migrate.ts");
if (isCli) {
  runMigration()
    .then((steps) => {
      for (const s of steps) {
        console.log(`${s.ok ? "OK " : "ERR"}  ${s.step}${s.error ? `\n     ${s.error}` : ""}`);
      }
      process.exit(steps.some((s) => !s.ok) ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
