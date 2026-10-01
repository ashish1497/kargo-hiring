import "server-only";
import { cache } from "react";
import { db, getRubric, ROLES, type Role } from "./db";
import { cutoff, otherRole, rank } from "./ranking";

export type Row = {
  id: string;
  name: string;
  appliedRole: Role;
  status: "processing" | "scored" | "failed";
  error: string | null;
  headline: string | null;
  totals: Record<Role, number | null>;
  rank: number | null; // within applied role
  aboveLine: boolean;
  /** Would sit above the line in the other role's pool too. */
  otherRoleFit: boolean;
  criterionScores: Record<Role, number[]>; // by position
  email: { kind: "invite" | "rejection"; status: string } | null;
  hasBrief: boolean;
  createdAt: string;
};

/** All candidates with totals, ranks and email state; deduplicated per request. */
export const loadRows = cache(async function loadRows(): Promise<Row[]> {
  const [cands, pii, totals, scores, emails, briefs, rubric] = await Promise.all([
    db().from("candidates").select("id, applied_role, status, error, headline, created_at"),
    db().from("candidate_pii").select("candidate_id, name"),
    db().from("candidate_totals").select("*"),
    db().from("scores").select("candidate_id, criterion_id, role, score"),
    db().from("emails").select("candidate_id, kind, status"),
    db().from("briefs").select("candidate_id, role"),
    getRubric(),
  ]);
  for (const r of [cands, pii, totals, scores, emails, briefs]) if (r.error) throw r.error;

  const totalOf = (id: string, role: Role) => {
    const t = totals.data!.find((x) => x.candidate_id === id && x.role === role);
    return t ? Number(t.total) : null;
  };

  const rows: Row[] = cands.data!.map((c) => ({
    id: c.id,
    name: pii.data!.find((p) => p.candidate_id === c.id)?.name || c.headline || "(unnamed)",
    appliedRole: c.applied_role,
    status: c.status,
    error: c.error,
    headline: c.headline,
    totals: { PM: totalOf(c.id, "PM"), SPM: totalOf(c.id, "SPM") },
    rank: null,
    aboveLine: false,
    otherRoleFit: false,
    criterionScores: Object.fromEntries(
      ROLES.map((role) => [
        role,
        rubric
          .filter((k) => k.role === role)
          .map((k) => scores.data!.find((s) => s.candidate_id === c.id && s.criterion_id === k.id)?.score ?? 0),
      ]),
    ) as Record<Role, number[]>,
    email: emails.data!.find((e) => e.candidate_id === c.id) ?? null,
    hasBrief: briefs.data!.some((b) => b.candidate_id === c.id && b.role === c.applied_role),
    createdAt: c.created_at,
  }));

  const ranked = rank(rows.filter((r) => r.status === "scored"));
  for (const r of rows) {
    const mine = ranked.find((x) => x.id === r.id);
    r.rank = mine?.rank ?? null;
    r.aboveLine = mine?.aboveLine ?? false;
    const other = otherRole(r.appliedRole);
    const bar = cutoff(ranked, other);
    r.otherRoleFit = Boolean(mine) && bar !== undefined && (r.totals[other] ?? 0) >= bar && !r.aboveLine;
  }
  return rows;
});

export async function loadCandidate(id: string) {
  const [cand, pii, scores, briefs, email, rubric] = await Promise.all([
    db().from("candidates").select("*").eq("id", id).maybeSingle(),
    db().from("candidate_pii").select("*").eq("candidate_id", id).maybeSingle(),
    db().from("scores").select("*").eq("candidate_id", id),
    db().from("briefs").select("*").eq("candidate_id", id),
    db().from("emails").select("*").eq("candidate_id", id).maybeSingle(),
    getRubric(),
  ]);
  if (!cand.data) return null;
  return {
    candidate: cand.data,
    pii: pii.data,
    rubric,
    scores: scores.data ?? [],
    briefs: briefs.data ?? [],
    email: email.data,
    fileUrl: cand.data.file_path ? `/api/candidates/${id}/cv` : null,
  };
}
