// Deterministic personal-detail extraction. Runs before any AI call, so name, email, phone and
// profile links never leave our server. Everything downstream works on `content` only.

export type Pii = { name: string; email: string; phone: string; links: string[] };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Profile/contact URLs. Company websites in work history are left alone.
const LINK =
  /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|leetcode\.com|behance\.net|dribbble\.com|medium\.com|twitter\.com|x\.com)\/[^\s|·,;)]+/gi;
// Exactly 10 digits (optional separators, optional country code). Fixed width so phones that
// PDF extraction glues together ("97293 4421897293 44218") still split into separate matches.
const PHONE = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9}\d/g;
// 2-4 words, each capitalised ("Priya Krishnan", "ROHAN MEHTA"); initials allowed ("R. Kumar").
const NAME_LINE = /^[A-Z][A-Za-z'-]*\.?(?:\s+[A-Z][A-Za-z'-]*\.?){1,3}$/;
// Job titles and CV section headings that look like names to the regex above.
const TITLE_WORDS =
  /\b(manager|product|senior|engineer|lead|head|profile|summary|synopsis|resume|curriculum|vitae|experience|operations|strategy|consultant|analyst|director|marketing|sales|founder|associate|core|competencies|skills|expertise|qualifications|education|objective|contact|about|projects|achievements|work|career|highlights|professional|academic|college|university|school|institute|technology|engineering|certifications?|languages|interests|references|personal|details)\b/i;

const digits = (s: string) => s.replace(/\D/g, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

const flexible = (name: string) => new RegExp(name.split(/\s+/).map(escape).join("\\s*"), "i");

// Lines near the email: multi-column PDFs often put the header block at the end of the text.
function nameNearEmail(text: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => EMAIL.test(l));
  EMAIL.lastIndex = 0;
  if (at < 0) return "";
  for (const line of lines.slice(Math.max(0, at - 3), at + 1).reverse()) {
    const m = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?=\s*$|[A-Z]{2,}|\s*[a-z0-9._%+-]+@)/);
    if (m && !TITLE_WORDS.test(m[1])) return m[1];
    const caps = line.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,2})\b/);
    if (caps && !TITLE_WORDS.test(caps[1])) return titleCase(caps[1]);
  }
  return "";
}

function nameFromText(text: string): string {
  for (const raw of text.split("\n").slice(0, 6)) {
    let line = raw.trim();
    if (!line || /[@\d|·]/.test(line)) continue;
    // PDFs sometimes repeat the header: "ROHAN MEHTA Rohan Mehta"
    const words = line.split(/\s+/);
    if (words.length % 2 === 0) {
      const half = words.length / 2;
      const a = words.slice(0, half).join(" ");
      if (a.toLowerCase() === words.slice(half).join(" ").toLowerCase()) line = a;
    }
    if (NAME_LINE.test(line) && !TITLE_WORDS.test(line)) return titleCase(line);
  }
  return "";
}

function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/^(cv|resume|pm|spm)[_-]/i, "");
  const words = base
    .split(/[_\-\s]+/)
    .filter((w) => /^[A-Za-z]+$/.test(w) && !/^(cv|resume|final|updated|v\d)$/i.test(w));
  return words.length >= 2 ? titleCase(words.join(" ")) : "";
}

export function splitPii(
  text: string,
  fileName: string,
): { pii: Pii; content: string; nameConfirmed: boolean } {
  // PDF extraction can glue the preceding all-caps name onto the address ("REDDYsquad_5@...").
  const email = (text.match(EMAIL)?.[0] ?? "").replace(/^[A-Z]{2,}(?=[a-z0-9])/, "");
  const links = [...new Set(text.match(LINK) ?? [])];
  const phones = [...new Set(text.match(PHONE) ?? [])];
  // Filename wins when the CV text confirms it; otherwise header line, then the email block.
  const fromFile = nameFromFileName(fileName);
  const confirmed = fromFile && flexible(fromFile).test(text) ? fromFile : "";
  const name = confirmed || nameFromText(text) || nameNearEmail(text) || fromFile;

  let content = text.replace(EMAIL, "[EMAIL]").replace(LINK, "[LINK]");
  for (const p of phones) content = content.split(p).join("[PHONE]");
  if (name) {
    content = content.replace(new RegExp(flexible(name).source, "gi"), "[CANDIDATE]");
    // First/last name tokens on their own (e.g. "Rohan" in a quote, "MEHTA" in a header).
    for (const part of name.split(/\s+/).filter((p) => p.length >= 3)) {
      content = content.replace(new RegExp(`\\b${escape(part)}\\b`, "gi"), "[CANDIDATE]");
    }
    content = content.replace(/(\[CANDIDATE\]\s*){2,}/g, "[CANDIDATE] ");
  }
  // Bare handle lines left behind by multi-column PDFs, e.g. "rohan-mehta".
  if (name) {
    const handle = name.toLowerCase().split(/\s+/).join("[-_.]?");
    content = content.replace(new RegExp(`\\b${handle}\\b`, "gi"), "[LINK]");
  }

  return {
    pii: { name, email, phone: phones[0]?.trim() ?? "", links },
    content: content.trim(),
    nameConfirmed: Boolean(name) && flexible(name).test(text),
  };
}

/** Returns the PII values still visible in `content` (should be empty). */
export function leakedPii(pii: Pii, content: string): string[] {
  const hay = content.toLowerCase();
  const leaks: string[] = [];
  if (pii.email && hay.includes(pii.email.toLowerCase())) leaks.push("email");
  if (pii.phone && digits(content).includes(digits(pii.phone))) leaks.push("phone");
  for (const part of pii.name.split(/\s+/).filter((p) => p.length >= 3)) {
    if (new RegExp(`\\b${escape(part)}\\b`, "i").test(content)) leaks.push(`name:${part}`);
  }
  for (const l of pii.links) if (hay.includes(l.toLowerCase())) leaks.push("link");
  return leaks;
}
