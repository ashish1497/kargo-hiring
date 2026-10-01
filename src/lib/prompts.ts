import { z } from "zod";
import type { Criterion, Role } from "./db";

const KARGO = `Kargo is a Series A logistics SaaS company in Mumbai (40 people, scaling to 70). It builds software
for mid-sized freight forwarders and 3PLs: shipment tracking, documentation and carrier coordination.
The founder, Arjun Mehta, is hiring a Product Manager (first PM on the core operations platform) and a
Senior Product Manager (owns the integration and data layer; most senior PM). Both report to Arjun. In-office, Mumbai.`;

const PRIVACY = `The CV has had personal details removed. [CANDIDATE], [EMAIL], [PHONE] and [LINK] are placeholders.
Never guess or invent a name, gender or contact detail.`;

// ---------- Scoring ----------

const criterionScore = z.object({
  criterion: z.number().int(),
  score: z.number().int().min(1).max(5),
  reason: z.string().min(1).max(400),
});

export const scoreSchema = z.object({
  headline: z.string().min(1).max(160),
  PM: z.array(criterionScore),
  SPM: z.array(criterionScore),
});
export type ScoreResult = z.infer<typeof scoreSchema>;

const criterionScoreJson = {
  type: "object",
  properties: {
    criterion: { type: "integer", description: "Criterion number from the rubric" },
    score: { type: "integer", minimum: 1, maximum: 5 },
    reason: { type: "string", description: "One line citing the CV evidence" },
  },
  required: ["criterion", "score", "reason"],
};

export const scoreJsonSchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One name-free line: current role, years, domain, notable background",
    },
    PM: { type: "array", items: criterionScoreJson },
    SPM: { type: "array", items: criterionScoreJson },
  },
  required: ["headline", "PM", "SPM"],
};

function rubricBlock(rubric: Criterion[], role: Role): string {
  return rubric
    .filter((c) => c.role === role)
    .map((c) => `${c.position}. ${c.name} (weight ${c.weight}%)\n   ${c.description}`)
    .join("\n");
}

export function scoringPrompt(rubric: Criterion[], cv: string) {
  const system = `You are a calibrated hiring evaluator for Kargo.
${KARGO}

The rubric below was derived from Kargo's own past hires: what its best people had in common, not what the
job description asks for. Score strictly against it.

RULES
- Score every criterion 1-5 for BOTH rubrics, using each criterion's own anchors (5, 3, 1; 2 and 4 sit between).
- Score only what the CV text shows. No credit for titles, years, college, certifications, tools or adjectives.
- Buzzwords without a concrete outcome ("strategic enabler", "orchestrated", "pioneered", "drove synergies")
  count as absent evidence.
- Each reason is one line that cites or closely paraphrases the specific CV line it rests on. If there is no
  evidence, say so ("No operational role in the CV").
- ${PRIVACY}

PM RUBRIC
${rubricBlock(rubric, "PM")}

SPM RUBRIC
${rubricBlock(rubric, "SPM")}`;

  const prompt = `Score this CV against both rubrics. Return every criterion number for each role exactly once.

CV:
"""
${cv}
"""`;
  return { system, prompt };
}

// ---------- Interview brief ----------

export const briefSchema = z.object({ brief: z.string().min(1).max(900) });
export const briefJsonSchema = {
  type: "object",
  properties: { brief: { type: "string", description: "Exactly three sentences" } },
  required: ["brief"],
};

export function briefPrompt(opts: {
  role: Role;
  cv: string;
  scores: { name: string; weight: number; score: number; reason: string }[];
  total: number;
  rank: number;
}) {
  const system = `You write interview briefs for Arjun Mehta, founder of Kargo.
${KARGO}
${PRIVACY}
Write exactly three sentences, plain and direct, no bullet points, no flattery:
1) Who this person is, in one line of concrete background.
2) Why they ranked where they did: the strongest rubric evidence and the weakest criterion.
3) The one thing Arjun must probe in the interview to confirm or kill the fit, phrased as what to ask.
Refer to the candidate as "they".`;
  const prompt = `Role: ${opts.role}. Rank ${opts.rank} among ${opts.role} applicants, score ${opts.total}/100.

Rubric scores:
${opts.scores.map((s) => `- ${s.name} (${s.weight}%): ${s.score}/5 — ${s.reason}`).join("\n")}

CV:
"""
${opts.cv}
"""`;
  return { system, prompt };
}

// ---------- Email draft ----------

export const emailSchema = z.object({
  subject: z.string().min(1).max(140),
  body: z.string().min(1).max(3000),
});
export const emailJsonSchema = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
};

export function emailPrompt(opts: {
  kind: "invite" | "rejection";
  role: Role;
  cv: string;
  strengths: string[];
}) {
  const roleName = opts.role === "PM" ? "Product Manager" : "Senior Product Manager";
  const intent =
    opts.kind === "invite"
      ? `An interview invitation. They applied for the role: thank them for applying and for their patience (the
process has been slow). Mention one or two specific things from their CV that made Arjun want to talk
(drawn from the strengths below). Propose a 45-minute conversation, in person at the Mumbai office or on a
video call, and ask them to reply with two or three time slots that work in the next week.`
      : `A warm, respectful rejection. Thank them for applying and for their patience (the process has been slow).
Name one specific, genuine strength from their CV so it is clearly not a form letter. Say plainly that Kargo is
not moving forward for the ${roleName} role. Do not give a ranking, score or criticism. Do not promise future
roles; you may say Arjun would be glad to hear from them if a future opening fits.`;

  const system = `You draft candidate emails from Arjun Mehta, founder of Kargo, for the ${roleName} role.
${KARGO}
${PRIVACY}
Write the email: ${intent}

FORMAT
- Open with "Hi {{first_name}}," exactly. Use {{first_name}} wherever the name is needed; never write a name.
- Plain text, 90-160 words in the body, short paragraphs, warm and direct, no corporate filler, no emojis.
- Sign off as:
Arjun Mehta
Founder, Kargo`;

  const prompt = `Candidate strengths from the rubric review:
${opts.strengths.map((s) => `- ${s}`).join("\n") || "- (none recorded)"}

CV:
"""
${opts.cv}
"""`;
  return { system, prompt };
}
