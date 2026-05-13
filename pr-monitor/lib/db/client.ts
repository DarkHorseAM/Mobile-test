import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  // Allow the module to be imported during build/typecheck without env;
  // throw lazily when queries are attempted.
}

const sql = neon(url ?? "postgres://placeholder@localhost/placeholder");
export const db = drizzle(sql, { schema });
export { schema };
