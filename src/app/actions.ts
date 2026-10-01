"use server";

import { refresh } from "next/cache";
import { db, type Role } from "@/lib/db";
import { sendCandidateEmail } from "@/lib/mail";
import { generateBrief, rankings } from "@/lib/pipeline";

export async function saveEmail(id: string, subject: string, body: string) {
  const { error } = await db()
    .from("emails")
    .update({ subject, body_template: body, updated_at: new Date().toISOString() })
    .eq("candidate_id", id)
    .in("status", ["draft", "failed"]);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}

export async function saveName(id: string, name: string) {
  const { error } = await db()
    .from("candidate_pii")
    .update({ name: name.trim(), name_confirmed: true })
    .eq("candidate_id", id);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}

export async function makeBrief(id: string, role: Role) {
  const r = (await rankings()).find((x) => x.id === id && x.role === role);
  if (!r) return { ok: false as const, error: "Candidate is not scored for this role" };
  try {
    await generateBrief(r);
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
  refresh();
  return { ok: true as const };
}

// Arjun's Confirm click: the only path by which any email leaves the system.
export async function confirmSend(id: string) {
  const result = await sendCandidateEmail(id);
  refresh();
  return result;
}
