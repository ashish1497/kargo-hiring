import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

export async function extractCvText(fileName: string, bytes: Uint8Array): Promise<string> {
  const lower = fileName.toLowerCase();
  let text: string;
  if (lower.endsWith(".pdf") || isPdf(bytes)) {
    const pdf = await getDocumentProxy(bytes);
    ({ text } = await extractText(pdf, { mergePages: true }));
  } else if (lower.endsWith(".docx") || isZip(bytes)) {
    ({ value: text } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) }));
  } else {
    throw new Error(`Unsupported file type: ${fileName} (accepted: ${ACCEPTED_EXTENSIONS.join(", ")})`);
  }
  text = cleanText(text);
  if (text.length < 200) throw new Error("Could not read enough text from this CV (scanned image?)");
  return text;
}

/** Normalises extracted text. Strips NUL/control chars, which Postgres text columns reject. */
export function cleanText(raw: string): string {
  return (
    raw
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffe\uffff]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]+$/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b; // PK
