import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CandidateView } from "@/components/CandidateView";
import { ROLES, type Role } from "@/lib/db";
import { queuePosition } from "@/lib/ranking";
import { deliveryAddress, recipientAllowed } from "@/lib/mail";
import { loadCandidate, loadRows } from "@/lib/queries";

export default async function CandidatePage({ params }: PageProps<"/candidates/[id]">) {
  const { id } = await params;
  await connection();
  const [data, rows] = await Promise.all([loadCandidate(id), loadRows()]);
  if (!data) notFound();
  const { candidate, pii, rubric, scores, briefs, email, fileUrl } = data;
  const row = rows.find((r) => r.id === id)!;
  const applied = candidate.applied_role as Role;
  const queue = rows
    .filter((r) => r.appliedRole === applied && r.status === "scored")
    .sort((a, b) => a.rank! - b.rank!)
    .map((r) => ({ id: r.id, decided: r.email?.status === "sent" }));

  return (
    // Keyed so client navigation between candidates resets draft state.
    <CandidateView
      key={id}
      id={id}
      applied={applied}
      status={row.status}
      error={candidate.error}
      headline={candidate.headline}
      fileUrl={fileUrl}
      pii={{ name: pii?.name ?? "", email: pii?.email ?? "", phone: pii?.phone ?? "", confirmed: pii?.name_confirmed ?? false }}
      totals={row.totals}
      rank={row.rank}
      poolSize={rows.filter((r) => r.appliedRole === applied && r.status === "scored").length}
      aboveLine={row.aboveLine}
      queue={queuePosition(queue, id)}
      brief={briefs.find((b) => b.role === applied)?.text ?? null}
      rubrics={ROLES.map((role) => ({
        role,
        criteria: rubric
          .filter((c) => c.role === role)
          .map((c) => {
            const s = scores.find((x) => x.criterion_id === c.id);
            return { id: c.id, name: c.name, weight: c.weight, description: c.description, score: s?.score ?? 0, reason: s?.reason ?? "" };
          }),
      }))}
      email={
        email
          ? {
              kind: email.kind,
              status: email.status,
              error: email.error,
              subject: email.subject,
              body: email.body_template,
              sentAt: email.sent_at,
              to: deliveryAddress(pii?.email ?? ""),
              toAllowed: recipientAllowed(deliveryAddress(pii?.email ?? "")),
            }
          : null
      }
    />
  );
}
