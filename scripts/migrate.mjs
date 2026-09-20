// Applies supabase/schema.sql to your Supabase database using SUPABASE_DB_URL.
// The schema is idempotent, so running it again is safe.
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL is empty in .env.local. Either add it, or paste supabase/schema.sql into the Supabase SQL Editor and press Run.");
  process.exit(1);
}

const sql = readFileSync("supabase/schema.sql", "utf8");
const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  const r = await client.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
  console.log(`Schema applied. ${r.rows.length} tables: ${r.rows.map((x) => x.table_name).join(", ")}`);
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
