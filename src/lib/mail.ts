import "server-only";
import { Resend } from "resend";
import { db } from "./db";
import { env } from "./env";

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

export function renderBody(template: string, fullName: string): string {
  return template.replace(/\{\{\s*first_name\s*\}\}/g, firstName(fullName));
}

export function recipientAllowed(email: string): boolean {
  const domain = env.allowedEmailDomain();
  return Boolean(email) && (!domain || email.toLowerCase().endsWith(`@${domain}`));
}

/** Where an email for this candidate is actually delivered: the test inbox if configured, else the CV's address. */
export function deliveryAddress(candidateEmail: string): string {
  return env.testRecipient() || candidateEmail;
}

/** Sends one confirmed draft. Only ever called from Arjun's Confirm click. */
export async function sendCandidateEmail(candidateId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const [{ data: email }, { data: pii }] = await Promise.all([
    db().from("emails").select("*").eq("candidate_id", candidateId).single(),
    db().from("candidate_pii").select("name, email").eq("candidate_id", candidateId).single(),
  ]);
  if (!email) return { ok: false, error: "No draft email for this candidate" };
  const to = deliveryAddress(pii?.email ?? "");
  if (!to) return { ok: false, error: "No email address found in this CV" };
  if (!recipientAllowed(to)) {
    return { ok: false, error: `Blocked: ${to} is outside the allowed test domain (${env.allowedEmailDomain()})` };
  }

  // Claim the draft so a double click cannot send twice.
  const { data: claimed } = await db()
    .from("emails")
    .update({ status: "sending", error: null })
    .eq("candidate_id", candidateId)
    .in("status", ["draft", "failed"])
    .select("candidate_id");
  if (!claimed?.length) return { ok: false, error: `Email is already ${email.status}` };

  const resend = new Resend(env.resendKey());
  const { data, error } = await resend.emails.send(
    {
      from: `Arjun Mehta (Kargo) <${env.resendFrom()}>`,
      to: [to],
      subject: email.subject,
      text: renderBody(email.body_template, pii?.name ?? ""),
    },
    { idempotencyKey: `candidate-${candidateId}-${email.updated_at}` },
  );

  if (error) {
    await db().from("emails").update({ status: "failed", error: error.message }).eq("candidate_id", candidateId);
    return { ok: false, error: error.message };
  }
  // The email has gone; if recording that fails, the row stays "sending", which blocks a resend.
  const { error: saveErr } = await db()
    .from("emails")
    .update({ status: "sent", resend_id: data?.id ?? null, sent_to: to, sent_at: new Date().toISOString() })
    .eq("candidate_id", candidateId);
  if (saveErr) return { ok: false, error: `Sent (Resend id ${data?.id}), but saving the status failed: ${saveErr.message}` };
  return { ok: true };
}
