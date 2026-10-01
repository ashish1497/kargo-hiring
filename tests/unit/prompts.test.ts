import { describe, expect, it } from "vitest";
import { briefPrompt, emailPrompt, scoreSchema, scoringPrompt } from "@/lib/prompts";
import type { Criterion } from "@/lib/db";

const rubric: Criterion[] = ["PM", "SPM"].flatMap((role) =>
  [1, 2].map((position) => ({
    id: `${role}${position}`,
    role: role as "PM" | "SPM",
    position,
    name: `${role} crit ${position}`,
    description: `desc ${role} ${position}`,
    source: "Rohan",
    weight: 50,
  })),
);

describe("scoringPrompt", () => {
  it("includes both rubrics with weights and the CV", () => {
    const { system, prompt } = scoringPrompt(rubric, "CV BODY");
    expect(system).toContain("PM RUBRIC\n1. PM crit 1 (weight 50%)");
    expect(system).toContain("SPM RUBRIC\n1. SPM crit 1 (weight 50%)");
    expect(system).toMatch(/No credit for titles, years, college, certifications/);
    expect(prompt).toContain("CV BODY");
  });
});

describe("scoreSchema", () => {
  it("rejects out-of-range scores", () => {
    const base = { headline: "h", SPM: [] };
    expect(scoreSchema.safeParse({ ...base, PM: [{ criterion: 1, score: 6, reason: "r" }] }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...base, PM: [{ criterion: 1, score: 0, reason: "r" }] }).success).toBe(false);
    expect(scoreSchema.safeParse({ ...base, PM: [{ criterion: 1, score: 3, reason: "r" }] }).success).toBe(true);
  });
});

describe("emailPrompt", () => {
  it("asks for the {{first_name}} placeholder and never a name", () => {
    for (const kind of ["invite", "rejection"] as const) {
      const { system } = emailPrompt({ kind, role: "PM", cv: "cv", strengths: ["s"] });
      expect(system).toContain('"Hi {{first_name}},"');
      expect(system).toMatch(/never write a name/);
      expect(system).toContain("Arjun Mehta\nFounder, Kargo");
    }
  });
  it("rejection forbids scores and promises", () => {
    const { system } = emailPrompt({ kind: "rejection", role: "SPM", cv: "cv", strengths: [] });
    expect(system).toContain("Senior Product Manager");
    expect(system).toMatch(/Do not give a ranking, score or criticism/);
  });
});

describe("briefPrompt", () => {
  it("asks for exactly three sentences with a probe", () => {
    const { system, prompt } = briefPrompt({ role: "PM", cv: "cv", scores: [{ name: "n", weight: 30, score: 4, reason: "r" }], total: 80, rank: 2 });
    expect(system).toMatch(/exactly three sentences/i);
    expect(system).toMatch(/probe/);
    expect(prompt).toContain("Rank 2 among PM applicants, score 80/100");
  });
});
