// Regression over the full seeded pool (checkpoint B-1 "done when" + ranking sanity), compared with
// the previous run's snapshot so LLM/prompt/rubric changes that move the shortlist get noticed.
// Usage: npm run regression   (after npm run seed:cvs). Snapshot: seed/.regression-snapshot.json (gitignored)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { leakedPii } from "../src/lib/pii";
import { rank, roleFromFileName, SHORTLIST_SIZE, type Role } from "../src/lib/ranking";
import { check, finish, http, sb, sentences } from "./lib/harness.mts";

const SNAPSHOT = "seed/.regression-snapshot.json";
const [cands, pii, totals, scores, briefs, emails] = await Promise.all([
  sb.from("candidates").select("id, file_name, applied_role, status, cv_content, created_at"),
  sb.from("candidate_pii").select("*"),
  sb.from("candidate_totals").select("*"),
  sb.from("scores").select("candidate_id, role"),
  sb.from("briefs").select("*"),
  sb.from("emails").select("*"),
]);
const all = cands.data!;
const scored = all.filter((c) => c.status === "scored");

console.log("Pool");
check(all.length === 60, `60 candidates in DB (${all.length})`);
check(scored.length === 60, `all 60 scored (${scored.length})`, all.filter((c) => c.status !== "scored").map((c) => c.file_name).join(", "));
check(new Set(all.map((c) => c.file_name)).size === all.length, "no duplicate CVs");
check(all.every((c) => c.applied_role === roleFromFileName(c.file_name)), "applied role follows filename (spm_ → SPM, else PM)");

console.log("\nPrivacy");
const leaks = scored.filter((c) => {
  const p = pii.data!.find((x) => x.candidate_id === c.id);
  return !p || !c.cv_content || leakedPii(p, c.cv_content).length > 0;
});
check(leaks.length === 0, "no personal details in any cv_content", leaks.map((c) => c.file_name).join(", "));
check(pii.data!.every((p) => p.email.endsWith("@pg27.mesaschool.co")), "every recipient is a MESA test address");

console.log("\nScores");
const scoreCount = (id: string, role: string) => scores.data!.filter((s) => s.candidate_id === id && s.role === role).length;
check(scored.every((c) => scoreCount(c.id, "PM") === 5 && scoreCount(c.id, "SPM") === 5), "every candidate has 5 PM + 5 SPM scores");

const ranked = rank(
  scored.map((c) => ({
    id: c.id,
    appliedRole: c.applied_role as Role,
    createdAt: c.created_at,
    totals: Object.fromEntries(totals.data!.filter((t) => t.candidate_id === c.id).map((t) => [t.role, Number(t.total)])),
  })),
);
const name = (id: string) => all.find((c) => c.id === id)!.file_name;

console.log("\nDrafts (top 5 per role: brief + invite; everyone else: rejection)");
for (const role of ["PM", "SPM"] as Role[]) {
  const mine = ranked.filter((r) => r.role === role);
  const top = mine.filter((r) => r.aboveLine);
  check(top.length === SHORTLIST_SIZE, `${role}: ${SHORTLIST_SIZE} above the line`);
  for (const r of top) {
    const b = briefs.data!.find((x) => x.candidate_id === r.id && x.role === role);
    const e = emails.data!.find((x) => x.candidate_id === r.id);
    check(b && sentences(b.text) === 3, `${role} #${r.rank} ${name(r.id)}: 3-sentence brief`, b?.text.slice(0, 100));
    check(e?.kind === "invite", `${role} #${r.rank} ${name(r.id)}: invite draft`);
  }
  const below = mine.filter((r) => !r.aboveLine);
  const wrong = below.filter((r) => emails.data!.find((x) => x.candidate_id === r.id)?.kind !== "rejection");
  check(wrong.length === 0, `${role}: all ${below.length} below the line have a rejection draft`, wrong.map((r) => name(r.id)).join(", "));
}
check(emails.data!.every((e) => e.body_template.includes("{{first_name}}") && !e.body_template.includes("[CANDIDATE]")), "every draft uses {{first_name}}");
check(emails.data!.every((e) => !/\b(score|ranked|rank|rubric)\b/i.test(e.kind === "rejection" ? e.body_template : "")), "no rejection mentions scores or ranking");

console.log("\nRanking sanity (does the rubric pick 'people like Arjun's best hires'?)");
const pos = (file: string) => ranked.find((r) => name(r.id) === file);
check(pos("pm_01_priya_krishnan.pdf")?.aboveLine, "pm_01 Priya Krishnan (ops floor → sole PM, kills features) is in the PM top 5", `rank ${pos("pm_01_priya_krishnan.pdf")?.rank}`);
check(pos("spm_16_siddharth_rao.pdf")?.aboveLine, "spm_16 Siddharth Rao (JNPT ops → Head of Product) is in the SPM top 5", `rank ${pos("spm_16_siddharth_rao.pdf")?.rank}`);
const cohort = ranked.filter((r) => /^\d+_/.test(name(r.id)));
check(cohort.filter((r) => r.aboveLine).length <= 1, `at most 1 of the 30 unprefixed (cohort) CVs makes the PM top 5 (${cohort.filter((r) => r.aboveLine).length})`);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const designed = ranked.filter((r) => r.role === "PM" && /^pm_/.test(name(r.id)));
check(avg(designed.map((r) => r.total)) > avg(cohort.map((r) => r.total)), `pm_ CVs average higher than cohort CVs (${avg(designed.map((r) => r.total)).toFixed(0)} vs ${avg(cohort.map((r) => r.total)).toFixed(0)})`);

console.log("\nPages");
for (const p of ["/", "/roles/PM", "/roles/SPM", `/candidates/${ranked[0].id}`]) check((await http(p)).status === 200, `${p} → 200`);

// Compare with the previous snapshot.
const snap = Object.fromEntries(ranked.map((r) => [`${r.role}:${name(r.id)}`, { total: r.total, rank: r.rank, aboveLine: r.aboveLine }]));
if (existsSync(SNAPSHOT)) {
  console.log("\nDrift vs previous snapshot");
  const prev = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as typeof snap;
  for (const role of ["PM", "SPM"]) {
    const now = Object.keys(snap).filter((k) => k.startsWith(role) && snap[k].aboveLine);
    const then = Object.keys(prev).filter((k) => k.startsWith(role) && prev[k].aboveLine);
    const overlap = now.filter((k) => then.includes(k)).length;
    check(overlap >= 3, `${role} top 5 overlaps previous run by ≥3 (${overlap}/5)`);
  }
  const deltas = Object.keys(snap).filter((k) => prev[k]).map((k) => Math.abs(snap[k].total - prev[k].total));
  check(avg(deltas) <= 10, `mean score drift ≤ 10 points (${avg(deltas).toFixed(1)})`);
}
writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 2));

console.log("\nShortlists");
for (const role of ["PM", "SPM"] as Role[]) {
  console.log(`  ${role}: ` + ranked.filter((r) => r.role === role).slice(0, 8).map((r) => `${r.rank}.${name(r.id).replace(/\.\w+$/, "")} ${r.total}`).join(" · "));
}
finish("regression");
