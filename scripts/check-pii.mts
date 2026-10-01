// Dry run: parse every CV in seed/resumes and report extracted PII + leaks. No network.
import { readdirSync, readFileSync } from "node:fs";
import { extractCvText } from "../src/lib/parse";
import { splitPii, leakedPii } from "../src/lib/pii";

const dir = process.argv[2] ?? "seed/resumes";
for (const f of readdirSync(dir).sort()) {
  try {
    const text = await extractCvText(f, new Uint8Array(readFileSync(`${dir}/${f}`)));
    const { pii, content, nameConfirmed } = splitPii(text, f);
    const leaks = leakedPii(pii, content);
    console.log(`${leaks.length ? "LEAK" : "ok  "} ${f.padEnd(30)} ${pii.name.padEnd(22)} ${pii.email.padEnd(30)} ${pii.phone.padEnd(16)} ${nameConfirmed ? "" : "NAME?"} ${leaks.join(",")}`);
  } catch (e) {
    console.log(`FAIL ${f} ${(e as Error).message}`);
  }
}
