// Pure ranking logic, shared by the pipeline (which drafts follow the line) and the dashboard.

export type Role = "PM" | "SPM";
export const ROLES: Role[] = ["PM", "SPM"];
// How many candidates per role sit above the line (brief + invite draft).
export const SHORTLIST_SIZE = 5;

export type Rankable = {
  id: string;
  appliedRole: Role;
  createdAt: string;
  totals: Partial<Record<Role, number | null>>;
};

export type Ranked = { id: string; role: Role; total: number; rank: number; aboveLine: boolean };

/** Ranks candidates within their applied role: total desc, then earliest upload. */
export function rank(candidates: Rankable[], size = SHORTLIST_SIZE): Ranked[] {
  return ROLES.flatMap((role) =>
    candidates
      .filter((c) => c.appliedRole === role)
      .map((c) => ({ c, total: c.totals[role] ?? 0 }))
      .sort((a, b) => b.total - a.total || a.c.createdAt.localeCompare(b.c.createdAt))
      .map(({ c, total }, i) => ({ id: c.id, role, total, rank: i + 1, aboveLine: i < size })),
  );
}

/** Lowest total that is still above the line for `role`, or undefined if the pool is short. */
export function cutoff(ranked: Ranked[], role: Role, size = SHORTLIST_SIZE): number | undefined {
  return ranked.find((r) => r.role === role && r.rank === size)?.total;
}

export function otherRole(role: Role): Role {
  return role === "PM" ? "SPM" : "PM";
}

/** Weighted 0-100 total: sum(score/5 * weight). Mirrors the candidate_totals SQL view. */
export function weightedTotal(scores: { score: number; weight: number }[]): number {
  return Math.round(scores.reduce((a, s) => a + (s.score / 5) * s.weight, 0) * 10) / 10;
}

/** Role from a CV filename: "spm_" prefix means SPM; anything else (incl. no prefix) is PM. */
export function roleFromFileName(fileName: string): Role {
  return /^spm[_-]/i.test(fileName) ? "SPM" : "PM";
}

export type QueueItem = { id: string; decided: boolean };
export type QueuePosition = {
  position: number; // 1-based, in rank order
  total: number;
  decided: number;
  prevId: string | null;
  nextId: string | null;
  /** Next candidate after this one still awaiting a decision (wraps around), or null if all done. */
  nextUndecidedId: string | null;
};

/**
 * Triage queue over one role's ranked list: where the current candidate sits and where to go next.
 * A candidate is "decided" once their email (invite or rejection) has been sent.
 */
export function queuePosition(queue: QueueItem[], currentId: string): QueuePosition | null {
  const i = queue.findIndex((q) => q.id === currentId);
  if (i < 0) return null;
  const after = [...queue.slice(i + 1), ...queue.slice(0, i)];
  return {
    position: i + 1,
    total: queue.length,
    decided: queue.filter((q) => q.decided).length,
    prevId: queue[i - 1]?.id ?? null,
    nextId: queue[i + 1]?.id ?? null,
    nextUndecidedId: after.find((q) => !q.decided)?.id ?? null,
  };
}

/** First candidate in rank order still awaiting a decision. */
export function firstUndecided(queue: QueueItem[]): string | null {
  return queue.find((q) => !q.decided)?.id ?? null;
}
