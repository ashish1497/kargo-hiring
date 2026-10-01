import { NextResponse } from "next/server";
import { ROLES, type Role } from "@/lib/db";
import { ACCEPTED_EXTENSIONS } from "@/lib/parse";
import { createCandidate, processCandidate } from "@/lib/pipeline";

export const maxDuration = 120;

const MAX_BYTES = 4 * 1024 * 1024;

// Trigger + Input: one CV and the role it was submitted for.
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const role = form.get("role");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ROLES.includes(role as Role)) return NextResponse.json({ error: "Role must be PM or SPM" }, { status: 400 });
  if (!ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
    return NextResponse.json({ error: `Only ${ACCEPTED_EXTENSIONS.join(", ")} files` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File larger than 4 MB" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = await createCandidate(file.name, bytes, role as Role);
  try {
    await processCandidate(id, bytes);
    return NextResponse.json({ id, status: "scored" });
  } catch (e) {
    return NextResponse.json({ id, status: "failed", error: (e as Error).message }, { status: 422 });
  }
}
