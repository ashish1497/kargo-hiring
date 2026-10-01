// Uploads every CV in seed/resumes through the real upload API, then drafts briefs/emails.
// Role comes from the filename: spm_ prefix → SPM, anything else → PM. Skips files already loaded.
// Usage: npm run seed:cvs   (needs `npm run dev` running)
import { readdirSync } from "node:fs";
import { roleFromFileName } from "../src/lib/ranking";
import { pool, sb, syncAll, upload } from "./lib/harness.mts";

const DIR = process.argv[2] ?? "seed/resumes";
const files = readdirSync(DIR).filter((f) => /\.(pdf|docx)$/i.test(f)).sort();
const { data: existing } = await sb.from("candidates").select("id, file_name, status");
const done = new Set(existing!.filter((c) => c.status === "scored").map((c) => c.file_name));

// Clear failed/stale rows for files we are about to (re)load so each CV has exactly one row.
const stale = existing!.filter((c) => c.status !== "scored" && files.includes(c.file_name)).map((c) => c.id);
if (stale.length) await sb.from("candidates").delete().in("id", stale);

const todo = files.filter((f) => !done.has(f));
console.log(`${files.length} CVs, ${done.size} already scored, uploading ${todo.length}`);

const t0 = Date.now();
const failed: string[] = [];
await pool(todo, 3, async (f) => {
  const role = roleFromFileName(f);
  const { status, json } = await upload(`${DIR}/${f}`, role);
  const ok = status === 200 && json.status === "scored";
  if (!ok) failed.push(`${f}: ${json.error}`);
  console.log(`${ok ? "✓" : "✗"} ${role.padEnd(3)} ${f}${ok ? "" : ` — ${json.error}`}`);
});
console.log(`scored in ${((Date.now() - t0) / 1000).toFixed(0)}s; drafting briefs + emails…`);
await syncAll();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s${failed.length ? `; ${failed.length} failed` : ""}`);
process.exit(failed.length ? 1 : 0);
