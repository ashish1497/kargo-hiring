export function parseRubric(text) {
  const out = [];
  const sections = text.split(/^-{5,}\s*(PM|SPM)\s*-{5,}\s*$/m);
  // split with a capture group → [before, "PM", body, "SPM", body]
  for (let i = 1; i < sections.length; i += 2) {
    const role = sections[i];
    const body = sections[i + 1].split(/^={5,}/m)[0];
    const blocks = body.split(/^(?=\d+\.\s)/m).filter((b) => /^\d+\.\s/.test(b));
    for (const block of blocks) {
      const [, position, name] = block.match(/^(\d+)\.\s+(.+)$/m);
      const description = block
        .match(/What a strong candidate looks like:\s*([\s\S]*?)\nSource:/)[1]
        .replace(/\s+/g, " ")
        .trim();
      const source = (block.match(/Source:\s*([\s\S]*?)\nWeight:/)?.[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const weight = Number(block.match(/Weight:\s*(\d+)%/)[1]);
      out.push({ role, position: Number(position), name: name.trim(), description, source, weight });
    }
  }
  for (const role of ["PM", "SPM"]) {
    const rows = out.filter((r) => r.role === role);
    const sum = rows.reduce((a, r) => a + r.weight, 0);
    if (rows.length < 4 || rows.length > 6) throw new Error(`${role}: ${rows.length} criteria, need 4-6`);
    if (sum !== 100) throw new Error(`${role}: weights sum to ${sum}, need 100`);
  }
  return out;
}
