import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractCvText } from "@/lib/parse";
import { leakedPii, splitPii } from "@/lib/pii";

const CV = `Priya Krishnan
Product Manager
+91 98442 31075 · priya.k@example.com · Mumbai · linkedin.com/in/priyakrishnan-pm
PROFESSIONAL SUMMARY
Product Manager with 4 years in freight-tech. Priya shipped 7 features in 14 months between 2022 and 2024.
Reduced exceptions by 34% across 400+ movements monthly.`;

describe("splitPii", () => {
  it("extracts name, email, phone and profile links", () => {
    const { pii, nameConfirmed } = splitPii(CV, "resume.pdf");
    expect(pii).toEqual({
      name: "Priya Krishnan",
      email: "priya.k@example.com",
      phone: "+91 98442 31075",
      links: ["linkedin.com/in/priyakrishnan-pm"],
    });
    expect(nameConfirmed).toBe(true);
  });

  it("removes every personal detail from the content, including lone first names", () => {
    const { pii, content } = splitPii(CV, "resume.pdf");
    expect(leakedPii(pii, content)).toEqual([]);
    expect(content).not.toMatch(/priya|krishnan|98442|example\.com|linkedin/i);
    expect(content).toContain("[CANDIDATE] shipped 7 features");
  });

  it("keeps work content: years, metrics, locations", () => {
    const { content } = splitPii(CV, "resume.pdf");
    expect(content).toContain("between 2022 and 2024");
    expect(content).toContain("34%");
    expect(content).toContain("400+ movements");
    expect(content).toContain("Mumbai");
  });

  it("splits phone numbers that PDF extraction glued together", () => {
    const text = "Rohan Mehta\n+91 97293 4421897293 44218 squad_1@pg27.mesaschool.co\n" + "x".repeat(50);
    const { pii, content } = splitPii(text, "01_rohan_mehta.pdf");
    expect(pii.phone).toBe("+91 97293 44218");
    expect(content).not.toMatch(/97293|44218/);
  });

  it("strips an all-caps name glued onto the email", () => {
    const text = "Harsh Reddy\nHARSH REDDYsquad_5@pg27.mesaschool.co +91 94473 20815\nWork history";
    const { pii, content } = splitPii(text, "22_harsh_reddy.pdf");
    expect(pii.email).toBe("squad_5@pg27.mesaschool.co");
    expect(leakedPii(pii, content)).toEqual([]);
  });

  it("prefers the filename name when the CV text confirms it", () => {
    const text = "PROFESSIONAL SYNOPSIS\nProduct leader...\nARNAV SENArnav Sen\narnav@example.com";
    const { pii, content } = splitPii(text, "03_arnav_sen.pdf");
    expect(pii.name).toBe("Arnav Sen");
    expect(content).not.toMatch(/arnav/i);
  });

  it("finds the name next to the email when it is not at the top", () => {
    const text = "SUMMARY\nBuilt things.\nMeera Pillai\nmeera.p@example.com\n";
    expect(splitPii(text, "Resume_2025.pdf").pii.name).toBe("Meera Pillai");
  });

  it("does not take a section heading or job title as the name", () => {
    const text = "Core Competencies\nSenior Product Manager\nKabir Mehta\nkabir@example.com";
    expect(splitPii(text, "cv.pdf").pii.name).toBe("Kabir Mehta");
  });

  it("flags the name as unconfirmed when it only comes from the filename", () => {
    const { pii, nameConfirmed } = splitPii("SUMMARY\nno name here at all\n", "cv_tanvi_jain.docx");
    expect(pii.name).toBe("Tanvi Jain");
    expect(nameConfirmed).toBe(false);
  });

  it("collapses a duplicated header name", () => {
    expect(splitPii("ROHAN MEHTA Rohan Mehta\nrest", "x.pdf").pii.name).toBe("Rohan Mehta");
  });
});

describe("leakedPii", () => {
  it("reports each kind of leak", () => {
    const pii = { name: "Ana Rao", email: "a@b.co", phone: "98765 43210", links: ["github.com/anarao"] };
    expect(leakedPii(pii, "Ana wrote a@b.co, call 9876543210, see github.com/anarao")).toEqual([
      "email",
      "phone",
      "name:Ana",
      "link",
    ]);
  });
});

// Regression over the real application pool: every CV must parse and redact cleanly.
const dirs = ["seed/resumes", "seed/hires"].filter((d) => existsSync(d));
describe.skipIf(!dirs.length)("seed CVs", () => {
  for (const dir of dirs) {
    for (const f of readdirSync(dir).filter((x) => /\.(pdf|docx)$/i.test(x))) {
      it(`${dir}/${f}`, async () => {
        const text = await extractCvText(f, new Uint8Array(readFileSync(`${dir}/${f}`)));
        const { pii, content, nameConfirmed } = splitPii(text, f);
        const expected = f
          .replace(/\.\w+$/, "")
          .replace(/^(cv_|pm_|spm_)?\d+_/, "")
          .split("_")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        expect(pii.name).toBe(expected);
        expect(nameConfirmed).toBe(true);
        expect(pii.email).toMatch(/^[^\s@]+@[^\s@]+\.\w+$/);
        expect(pii.phone.replace(/\D/g, "").length).toBeGreaterThanOrEqual(10);
        expect(leakedPii(pii, content)).toEqual([]);
        expect(content).not.toContain(pii.email);
        expect(content.length).toBeGreaterThan(500);
      });
    }
  }
});

describe("cleanText", () => {
  // Regression: 23_karan_das.pdf extracts with NUL bytes; Postgres rejected the row.
  it("strips NUL and other control characters but keeps newlines and tabs", async () => {
    const { cleanText } = await import("@/lib/parse");
    expect(cleanText("Led\u0000 ops\u0007 team\nNext\tline x")).toBe("Led ops team\nNext\tline x");
  });
  it("collapses blank runs and trailing spaces", async () => {
    const { cleanText } = await import("@/lib/parse");
    expect(cleanText("a  \n\n\n\nb ")).toBe("a\n\nb");
  });
});
