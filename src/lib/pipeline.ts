import "server-only";
import { db, getRubric, must, ROLES, type Criterion, type Role } from "./db";
import { generateJson } from "./gemini";
import { extractCvText } from "./parse";
import { leakedPii, splitPii } from "./pii";
import {
  briefJsonSchema,
  briefPrompt,
  briefSchema,
  emailJsonSchema,
  emailPrompt,
  emailSchema,
  scoreJsonSchema,
  scoreSchema,
  scoringPrompt,
} from "./prompts";
import { rank, type Ranked } from "./ranking";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** Step 0: store the file and create the candidate row. Returns the id. */
export async function createCandidate(fileName: string, bytes: Uint8Array, role: Role): Promise<string> {
  const { data, error } = await db()
    .from("candidates")
    .insert({ applied_role: role, file_name: fileName })
    .select("id")
    .single();
  if (error) throw error;
  const path = `${data.id}/${fileName.replace(/[^\w.-]+/g, "_")}`;
  const up = await db().storage.from("cvs").upload(path, bytes, { upsert: true });
  if (up.error) throw new Error(`Could not store the CV file: ${up.error.message}`);
  await must(db().from("candidates").update({ file_path: path }).eq("id", data.id));
  return data.id;
}

/** Steps 1-3: parse, split personal details, score against both rubrics. */
export async function processCandidate(id: string, bytes?: Uint8Array): Promise<void> {
  const { data: cand, error } = await db().from("candidates").select("*").eq("id", id).single();
  if (error) throw error;
  await must(db().from("candidates").update({ status: "processing", error: null }).eq("id", id));

  try {
    if (!bytes) {
      if (!cand.file_path) throw new Error("Original file missing; upload it again");
      const dl = await db().storage.from("cvs").download(cand.file_path);
      if (dl.error) throw dl.error;
      bytes = new Uint8Array(await dl.data.arrayBuffer());
    }

    // Context: split personal details out before anything reaches the AI.
    const text = await extractCvText(cand.file_name, bytes);
    const { pii, content, nameConfirmed } = splitPii(text, cand.file_name);
    const leaks = leakedPii(pii, content);
    if (leaks.length) throw new Error(`Personal details still visible after redaction (${leaks.join(", ")})`);

    const piiRow = { candidate_id: id, ...pii, name_confirmed: nameConfirmed };
    const { error: piiErr } = await db().from("candidate_pii").upsert(piiRow);
    if (piiErr) throw piiErr;
    await must(db().from("candidates").update({ cv_content: content }).eq("id", id));

    // Processing: score against both rubrics; totals are computed by the candidate_totals view.
    const rubric = await getRubric();
    const result = await generateJson({
      ...scoringPrompt(rubric, content),
      schema: scoreSchema,
      jsonSchema: scoreJsonSchema,
    });
    const rows = ROLES.flatMap((role) =>
      rubric
        .filter((c) => c.role === role)
        .map((c) => {
          const s = result[role].find((x) => x.criterion === c.position);
          if (!s) throw new Error(`Model skipped ${role} criterion ${c.position}`);
          return { candidate_id: id, criterion_id: c.id, role, score: s.score, reason: s.reason };
        }),
    );
    const { error: scoreErr } = await db().from("scores").upsert(rows);
    if (scoreErr) throw scoreErr;
    // New scores invalidate anything written from the old ones; syncDrafts regenerates them.
    await must(db().from("briefs").delete().eq("candidate_id", id));
    await must(db().from("emails").delete().eq("candidate_id", id).in("status", ["draft", "failed"]));
    await must(db().from("candidates").update({ status: "scored", headline: result.headline }).eq("id", id));
  } catch (e) {
    await db().from("candidates").update({ status: "failed", error: errMsg(e) }).eq("id", id);
    throw e;
  }
}

// ---------- Ranking + drafts ----------

/** Ranks scored candidates within their applied role. Top SHORTLIST_SIZE sit above the line. */
export async function rankings(): Promise<Ranked[]> {
  const [{ data: cands, error: e1 }, { data: totals, error: e2 }] = await Promise.all([
    db().from("candidates").select("id, applied_role, created_at").eq("status", "scored"),
    db().from("candidate_totals").select("*"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return rank(
    cands!.map((c) => ({
      id: c.id,
      appliedRole: c.applied_role,
      createdAt: c.created_at,
      totals: Object.fromEntries(
        totals!.filter((t) => t.candidate_id === c.id).map((t) => [t.role, Number(t.total)]),
      ),
    })),
  );
}

async function cvContent(id: string): Promise<string> {
  const row = await must(db().from("candidates").select("cv_content").eq("id", id).single());
  if (!row?.cv_content) throw new Error(`Candidate ${id} has no CV content; retry processing`);
  return row.cv_content as string;
}

async function scoreDetails(id: string, role: Role, rubric: Criterion[]) {
  const { data, error } = await db().from("scores").select("*").eq("candidate_id", id).eq("role", role);
  if (error) throw error;
  return rubric
    .filter((c) => c.role === role)
    .map((c) => {
      const s = data!.find((x) => x.criterion_id === c.id)!;
      return { name: c.name, weight: c.weight, score: s.score as number, reason: s.reason as string };
    });
}

export async function generateBrief(r: Ranked, rubric?: Criterion[]): Promise<void> {
  rubric ??= await getRubric();
  const cv = await cvContent(r.id);
  const scores = await scoreDetails(r.id, r.role, rubric);
  const { brief } = await generateJson({
    ...briefPrompt({ role: r.role, cv, scores, total: r.total, rank: r.rank }),
    schema: briefSchema,
    jsonSchema: briefJsonSchema,
    temperature: 0.4,
  });
  const { error } = await db()
    .from("briefs")
    .upsert({ candidate_id: r.id, role: r.role, text: brief.replace(/\[CANDIDATE\]/g, "they") });
  if (error) throw error;
}

async function generateEmail(r: Ranked, rubric: Criterion[]): Promise<void> {
  const kind = r.aboveLine ? "invite" : "rejection";
  const cv = await cvContent(r.id);
  const scores = await scoreDetails(r.id, r.role, rubric);
  const strengths = scores
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.reason);
  const { subject, body } = await generateJson({
    ...emailPrompt({ kind, role: r.role, cv, strengths }),
    schema: emailSchema,
    jsonSchema: emailJsonSchema,
    temperature: 0.6,
  });
  const { error } = await db()
    .from("emails")
    .upsert({
      candidate_id: r.id,
      kind,
      subject,
      body_template: body.replace(/\[CANDIDATE\]/g, "{{first_name}}"),
      status: "draft",
      error: null,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>) {
  const errors: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item).catch((e) => errors.push(errMsg(e)));
      }
    }),
  );
  return errors;
}

/**
 * Brings drafts in line with the current ranking: top 5 per role get a brief and an invite draft,
 * everyone else a rejection draft. Sent emails are never touched. Does at most `limit` AI jobs per
 * call so it fits in one serverless invocation; returns how many remain.
 */
export async function syncDrafts(limit = 12): Promise<{ done: number; remaining: number; errors: string[] }> {
  const rubric = await getRubric();
  const ranked = await rankings();
  const ids = ranked.map((r) => r.id);
  const [{ data: emails }, { data: briefs }] = await Promise.all([
    db().from("emails").select("candidate_id, kind, status").in("candidate_id", ids),
    db().from("briefs").select("candidate_id, role").in("candidate_id", ids),
  ]);

  const jobs: (() => Promise<void>)[] = [];
  for (const r of ranked) {
    if (r.aboveLine && !briefs?.some((b) => b.candidate_id === r.id && b.role === r.role)) {
      jobs.push(() => generateBrief(r, rubric));
    }
    const e = emails?.find((x) => x.candidate_id === r.id);
    const wanted = r.aboveLine ? "invite" : "rejection";
    if (!e || (e.kind !== wanted && e.status !== "sent" && e.status !== "sending")) {
      jobs.push(() => generateEmail(r, rubric));
    }
  }
  const batch = jobs.slice(0, limit);
  const errors = await pool(batch, 4, (job) => job());
  return { done: batch.length - errors.length, remaining: jobs.length - batch.length + errors.length, errors };
}
