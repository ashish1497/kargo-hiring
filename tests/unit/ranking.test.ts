import { describe, expect, it } from "vitest";
import { cutoff, firstUndecided, queuePosition, rank, roleFromFileName, weightedTotal, type Rankable } from "@/lib/ranking";

const c = (id: string, appliedRole: "PM" | "SPM", pm: number, spm: number, createdAt = "2026-10-01T00:00:00Z"): Rankable => ({
  id,
  appliedRole,
  createdAt,
  totals: { PM: pm, SPM: spm },
});

describe("rank", () => {
  it("ranks within the applied role only, by that role's total", () => {
    const r = rank([c("a", "PM", 50, 99), c("b", "PM", 80, 10), c("x", "SPM", 99, 40)]);
    expect(r.filter((x) => x.role === "PM").map((x) => x.id)).toEqual(["b", "a"]);
    expect(r.filter((x) => x.role === "SPM").map((x) => [x.id, x.total])).toEqual([["x", 40]]);
  });

  it("puts exactly the top N above the line", () => {
    const pool = Array.from({ length: 8 }, (_, i) => c(`p${i}`, "PM", 10 * i, 0));
    const r = rank(pool, 5);
    expect(r.filter((x) => x.aboveLine).map((x) => x.id)).toEqual(["p7", "p6", "p5", "p4", "p3"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("breaks ties by earliest upload so ranks are stable", () => {
    const r = rank([c("late", "PM", 70, 0, "2026-10-02T00:00:00Z"), c("early", "PM", 70, 0, "2026-10-01T00:00:00Z")]);
    expect(r.map((x) => x.id)).toEqual(["early", "late"]);
  });

  it("treats a missing total as 0", () => {
    const r = rank([{ id: "n", appliedRole: "PM", createdAt: "", totals: {} }, c("y", "PM", 1, 0)]);
    expect(r.map((x) => x.id)).toEqual(["y", "n"]);
  });

  it("handles a pool smaller than the shortlist", () => {
    const r = rank([c("only", "SPM", 0, 30)]);
    expect(r).toEqual([{ id: "only", role: "SPM", total: 30, rank: 1, aboveLine: true }]);
    expect(cutoff(r, "SPM")).toBeUndefined();
  });
});

describe("cutoff", () => {
  it("is the total of the last candidate above the line", () => {
    const r = rank(Array.from({ length: 7 }, (_, i) => c(`s${i}`, "SPM", 0, 10 * i)));
    expect(cutoff(r, "SPM")).toBe(20);
  });
});

describe("weightedTotal", () => {
  it("matches sum(score/5 * weight)", () => {
    expect(weightedTotal([{ score: 5, weight: 30 }, { score: 5, weight: 25 }, { score: 5, weight: 20 }, { score: 5, weight: 15 }, { score: 1, weight: 10 }])).toBe(92);
    expect(weightedTotal([{ score: 1, weight: 100 }])).toBe(20);
    expect(weightedTotal([{ score: 3, weight: 33 }])).toBe(19.8);
  });
});

describe("roleFromFileName", () => {
  it("spm_ prefix is SPM, everything else PM", () => {
    expect(roleFromFileName("spm_16_siddharth_rao.pdf")).toBe("SPM");
    expect(roleFromFileName("SPM-x.docx")).toBe("SPM");
    expect(roleFromFileName("pm_01_priya_krishnan.pdf")).toBe("PM");
    expect(roleFromFileName("01_rohan_mehta.pdf")).toBe("PM");
    expect(roleFromFileName("spmanager.pdf")).toBe("PM");
  });
});

describe("triage queue", () => {
  const q = [
    { id: "a", decided: true },
    { id: "b", decided: false },
    { id: "c", decided: true },
    { id: "d", decided: false },
  ];

  it("reports position, neighbours and progress", () => {
    expect(queuePosition(q, "b")).toEqual({ position: 2, total: 4, decided: 2, prevId: "a", nextId: "c", nextUndecidedId: "d" });
  });
  it("wraps to find the next undecided candidate", () => {
    expect(queuePosition(q, "d")!.nextUndecidedId).toBe("b");
    expect(queuePosition(q, "d")!.nextId).toBeNull();
    expect(queuePosition(q, "a")!.prevId).toBeNull();
  });
  it("never points back at the current candidate", () => {
    expect(queuePosition([{ id: "x", decided: false }], "x")!.nextUndecidedId).toBeNull();
  });
  it("returns null next-undecided when everyone is decided", () => {
    expect(queuePosition(q.map((x) => ({ ...x, decided: true })), "a")!.nextUndecidedId).toBeNull();
  });
  it("returns null for a candidate outside the queue", () => {
    expect(queuePosition(q, "zzz")).toBeNull();
  });
  it("firstUndecided starts at the top of the ranking", () => {
    expect(firstUndecided(q)).toBe("b");
    expect(firstUndecided([])).toBeNull();
  });
});

describe("strength scale", () => {
  it("maps 0–100 onto red → green text shades", async () => {
    const { strengthColor } = await import("@/components/marks");
    expect(strengthColor(0)).toBe("#b91c1c");
    expect(strengthColor(50)).toBe("#a16207");
    expect(strengthColor(98)).toBe("#15803d");
    expect(strengthColor(150)).toBe("#15803d");
    expect(strengthColor(-5)).toBe("#b91c1c");
  });
});
