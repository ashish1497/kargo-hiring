// Smoke test (checkpoint B-1 on 3 CVs) against a running app. Cleans up its own rows.
// Usage: npm run smoke   (needs `npm run dev` running; env from .env.local)
import { leakedPii } from "../src/lib/pii";
import { weightedTotal } from "../src/lib/ranking";
import { sendCandidateEmail } from "../src/lib/mail";
import { check, finish, http, sb, sentences, syncAll, upload } from "./lib/harness.mts";

const CASES = [
  { file: "seed/resumes/pm_01_priya_krishnan.pdf", role: "PM", label: "strong PM" },
  { file: "seed/resumes/spm_30_priya_iyer.pdf", role: "SPM", label: "SPM" },
  { file: "seed/resumes/03_arnav_sen.pdf", role: "PM", label: "ambiguous (17y delivery lead, applied PM)" },
];

const ids: string[] = [];
try {
  console.log("Validation");
  check((await http("/")).status === 200, "upload page 200");
  check((await upload(CASES[0].file, "CEO")).status === 400, "invalid role rejected (400)");
  check((await upload("package.json", "PM")).status === 400, "non-CV file rejected (400)");

  console.log("\nUpload + score 3 CVs");
  const t0 = Date.now();
  for (const c of CASES) {
    const { status, json } = await upload(c.file, c.role);
    if (json.id) ids.push(json.id);
    check(status === 200 && json.status === "scored", `${c.label} scored`, json.error);
  }

  console.log("\nExtraction (personal details split)");
  const { data: rubric } = await sb.from("rubric_criteria").select("*");
  for (const id of ids) {
    const [{ data: cand }, { data: pii }] = await Promise.all([
      sb.from("candidates").select("*").eq("id", id).single(),
      sb.from("candidate_pii").select("*").eq("candidate_id", id).single(),
    ]);
    check(pii?.name && pii?.email && pii?.phone, `${cand.file_name}: name/email/phone stored privately`);
    check(leakedPii(pii, cand.cv_content).length === 0, `${cand.file_name}: CV content has no personal details`);
    check(!/[\w.+-]+@[\w-]+\.\w+/.test(cand.cv_content), `${cand.file_name}: no email-like string in content`);
    check(cand.headline && !cand.headline.includes(pii.name.split(" ")[0]), `${cand.file_name}: headline is name-free`);

    const { data: scores } = await sb.from("scores").select("*").eq("candidate_id", id);
    const { data: totals } = await sb.from("candidate_totals").select("*").eq("candidate_id", id);
    for (const role of ["PM", "SPM"]) {
      const mine = scores!.filter((s) => s.role === role);
      check(mine.length === 5 && mine.every((s) => s.reason.length > 10), `${cand.file_name}: 5 ${role} scores with reasons`);
      const expected = weightedTotal(
        mine.map((s) => ({ score: s.score, weight: rubric!.find((r) => r.id === s.criterion_id)!.weight })),
      );
      const viewTotal = Number(totals!.find((t) => t.role === role)?.total);
      check(viewTotal === expected, `${cand.file_name}: ${role} total ${viewTotal} = weighted sum`, `expected ${expected}`);
    }
  }

  console.log("\nBriefs + draft emails");
  await syncAll();
  const { data: emails } = await sb.from("emails").select("*").in("candidate_id", ids);
  const { data: briefs } = await sb.from("briefs").select("*").in("candidate_id", ids);
  check(emails!.length === ids.length, "every candidate has a draft email");
  for (const e of emails!) {
    check(e.body_template.includes("{{first_name}}") && !/\[CANDIDATE\]/.test(e.body_template), `${e.kind} draft uses {{first_name}} placeholder`);
    check(e.status === "draft", `${e.kind} draft not sent automatically`);
  }
  for (const b of briefs!) check(sentences(b.text) === 3, `brief is 3 sentences (${sentences(b.text)})`, b.text.slice(0, 120));
  const strong = ids[0];
  check(briefs!.some((b) => b.candidate_id === strong), "strong PM has a brief");

  console.log("\nDashboard pages");
  const { data: pii0 } = await sb.from("candidate_pii").select("name").eq("candidate_id", strong).single();
  const pm = await http("/roles/PM");
  const pmHtml = await pm.text();
  check(pm.status === 200 && pmHtml.includes(pii0!.name), "PM shortlist lists the strong candidate");
  const detail = await http(`/candidates/${strong}`);
  const detailHtml = await detail.text();
  check(detail.status === 200 && detailHtml.includes("Interview brief") && /Send (invite|rejection)/.test(detailHtml), "candidate page shows brief + send decision");
  check(/\d{2} \/ \d{2} · \d+ decided/.test(detailHtml.replace(/<!-- -->/g, "")), "candidate page shows triage queue position");
  check(detailHtml.includes(`Hi ${pii0!.name.split(" ")[0]},`), "preview shows the real first name, not a placeholder");
  check((await http("/roles/CEO")).status === 404, "unknown role → 404");

  console.log("\nSend guard (no email leaves)");
  // Point delivery at an address outside the allowed domain, so the guard must block before Resend.
  const prevTo = process.env.EMAIL_TEST_RECIPIENT;
  process.env.EMAIL_TEST_RECIPIENT = "someone@gmail.com";
  try {
    const blocked = await sendCandidateEmail(strong);
    check(!blocked.ok && /Blocked/.test(blocked.ok ? "" : blocked.error), "recipient outside test domain is blocked");
  } finally {
    process.env.EMAIL_TEST_RECIPIENT = prevTo;
  }
  const { data: after } = await sb.from("emails").select("status").eq("candidate_id", strong).single();
  check(after!.status === "draft", "blocked send leaves the draft untouched");
  if (prevTo) check(detailHtml.includes(prevTo), `candidate page shows delivery to the test inbox (${prevTo})`);

  console.log(`\nPipeline time for 3 CVs incl. drafts: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally {
  if (ids.length && !process.env.KEEP) {
    const { data } = await sb.from("candidates").select("file_path").in("id", ids);
    await sb.storage.from("cvs").remove(data!.map((d) => d.file_path).filter(Boolean));
    await sb.from("candidates").delete().in("id", ids);
    console.log(`cleaned up ${ids.length} smoke candidates`);
    await syncAll(); // smoke rows may have shifted the line for seeded candidates; restore their drafts
  }
}
finish("smoke");
