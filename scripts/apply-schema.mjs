// Applies supabase/schema.sql (idempotent). Usage: npm run db:schema  (needs psql + SUPABASE_DB_URL)
import { execFileSync } from "node:child_process";

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL is not set");
execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", new URL("../supabase/schema.sql", import.meta.url).pathname], {
  stdio: "inherit",
});
// Make PostgREST see the new tables immediately.
execFileSync("psql", [url, "-q", "-c", "notify pgrst, 'reload schema'"], { stdio: "inherit" });
console.log("schema applied");
