import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal chainable fake of the Supabase client. Each terminal await resolves to the result
// configured for "<table>.<op>", recording every call for assertions.
type Result = { data: unknown; error: { message: string } | null };
const results: Record<string, Result> = {};
const calls: { table: string; op: string; payload?: unknown }[] = [];

function builder(table: string) {
  let op = "select";
  let payload: unknown;
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["eq", "in", "order", "limit"]) b[m] = chain;
  b.select = () => (op === "select" ? (op = "select") : null, b);
  for (const m of ["insert", "update", "upsert", "delete"]) {
    b[m] = (p?: unknown) => {
      op = m;
      payload = p;
      return b;
    };
  }
  b.single = b.maybeSingle = chain;
  b.then = (resolve: (r: Result) => void) => {
    calls.push({ table, op, payload });
    resolve(results[`${table}.${op}`] ?? { data: null, error: null });
  };
  return b;
}

const fakeDb = {
  from: (t: string) => builder(t),
  storage: { from: () => ({ upload: async () => ({ error: null }), download: async () => ({ error: null }) }) },
};

vi.mock("@/lib/db", async (orig) => ({
  ...(await orig<typeof import("@/lib/db")>()),
  db: () => fakeDb,
  getRubric: async () =>
    ["PM", "SPM"].flatMap((role) =>
      [1, 2, 3, 4, 5].map((position) => ({ id: `${role}${position}`, role, position, name: "n", description: "d", source: "s", weight: 20 })),
    ),
}));
const generateJson = vi.fn();
vi.mock("@/lib/gemini", () => ({ generateJson: (...a: unknown[]) => generateJson(...a) }));
vi.mock("@/lib/parse", () => ({
  extractCvText: async () =>
    "Priya Krishnan\npriya@example.com +91 98442 31075\nSole PM at a freight SaaS. Killed 3 features on usage data.",
}));

const { processCandidate } = await import("@/lib/pipeline");
const fullScores = {
  headline: "PM, freight SaaS",
  PM: [1, 2, 3, 4, 5].map((criterion) => ({ criterion, score: 4, reason: "r" })),
  SPM: [1, 2, 3, 4, 5].map((criterion) => ({ criterion, score: 3, reason: "r" })),
};

describe("processCandidate", () => {
  beforeEach(() => {
    for (const k of Object.keys(results)) delete results[k];
    calls.length = 0;
    generateJson.mockReset();
    results["candidates.select"] = { data: { id: "c1", file_name: "cv.pdf", file_path: "c1/cv.pdf" }, error: null };
  });

  it("stores PII separately, sends only redacted content to the AI, and marks scored", async () => {
    generateJson.mockResolvedValue(fullScores);
    await processCandidate("c1", new Uint8Array([1]));

    const pii = calls.find((c) => c.table === "candidate_pii" && c.op === "upsert")!.payload as Record<string, unknown>;
    expect(pii).toMatchObject({ name: "Priya Krishnan", email: "priya@example.com", phone: "+91 98442 31075" });

    const prompt = JSON.stringify(generateJson.mock.calls[0][0]);
    expect(prompt).not.toMatch(/Priya|Krishnan|priya@example\.com|98442/);
    expect(prompt).toContain("[CANDIDATE]");

    const scores = calls.find((c) => c.table === "scores" && c.op === "upsert")!.payload as unknown[];
    expect(scores).toHaveLength(10);
    expect(calls.at(-1)).toMatchObject({ table: "candidates", op: "update", payload: { status: "scored" } });
  });

  // Regression: re-scoring left the old brief/draft in place, written from the previous (bad) run.
  it("clears the brief and unsent draft when a candidate is re-scored", async () => {
    generateJson.mockResolvedValue(fullScores);
    await processCandidate("c1", new Uint8Array([1]));
    const ops = calls.map((c) => `${c.table}.${c.op}`);
    expect(ops).toContain("briefs.delete");
    expect(ops).toContain("emails.delete");
    expect(ops.indexOf("emails.delete")).toBeLessThan(ops.lastIndexOf("candidates.update"));
  });

  // Regression: a failed cv_content write used to pass silently and the candidate was scored anyway.
  it("fails the candidate (and never calls the AI) when a DB write fails", async () => {
    results["candidates.update"] = { data: null, error: { message: "connection reset" } };
    await expect(processCandidate("c1", new Uint8Array([1]))).rejects.toThrow("connection reset");
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("fails when the model skips a criterion", async () => {
    generateJson.mockResolvedValue({ ...fullScores, SPM: fullScores.SPM.slice(0, 4) });
    await expect(processCandidate("c1", new Uint8Array([1]))).rejects.toThrow(/skipped SPM criterion 5/);
    expect(calls.at(-1)).toMatchObject({ table: "candidates", op: "update", payload: { status: "failed" } });
    expect(calls.some((c) => c.table === "scores")).toBe(false);
  });
});
