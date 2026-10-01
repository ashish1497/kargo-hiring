import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRubric } from "../../scripts/rubric-parse.mjs";

type Row = { role: string; position: number; name: string; description: string; source: string; weight: number };
const rows: Row[] = parseRubric(readFileSync("rubric.txt", "utf8"));

describe("rubric.txt", () => {
  for (const role of ["PM", "SPM"]) {
    const mine = rows.filter((r) => r.role === role);
    it(`${role}: 4-6 criteria, weights sum to 100`, () => {
      expect(mine.length).toBeGreaterThanOrEqual(4);
      expect(mine.length).toBeLessThanOrEqual(6);
      expect(mine.reduce((a, r) => a + r.weight, 0)).toBe(100);
    });
    it(`${role}: every criterion has a description and a hire profile behind it`, () => {
      const hires = /Rohan|Sunita|Aditya|Meghna|Lavanya|Vikram|Preetham|Rahul/;
      for (const r of mine) {
        expect(r.description.length).toBeGreaterThan(80);
        expect(r.source).toMatch(hires);
        expect(r.description).not.toMatch(/^As PM/);
      }
    });
  }

  it("SPM weighs independence higher than PM", () => {
    const w = (role: string) => rows.find((r) => r.role === role && /layer above/i.test(r.name))!.weight;
    expect(w("SPM")).toBeGreaterThan(w("PM"));
  });

  it("rejects weights that do not sum to 100", () => {
    const bad = readFileSync("rubric.txt", "utf8").replace("Weight: 30%", "Weight: 31%");
    expect(() => parseRubric(bad)).toThrow(/weights sum to 101/);
  });
});
