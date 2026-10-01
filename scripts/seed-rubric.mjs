// Parses rubric.txt and upserts one rubric_criteria row per criterion per role.
// Usage: node --env-file=.env.local scripts/seed-rubric.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseRubric } from "./rubric-parse.mjs";


const rows = parseRubric(readFileSync(new URL("../rubric.txt", import.meta.url), "utf8"));
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { error } = await db.from("rubric_criteria").upsert(rows, { onConflict: "role,position" });
if (error) throw error;
for (const r of rows) console.log(`${r.role} ${r.position}. ${r.name} — ${r.weight}%`);
