"use client";

import { App, Button, Input, Popconfirm, Tooltip } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmSend, makeBrief, saveEmail, saveName } from "@/app/actions";
import { ScoreCells, TotalBar } from "@/components/marks";
import { RetryButton } from "@/components/RetryButton";
import { otherRole, SHORTLIST_SIZE, type QueuePosition, type Role } from "@/lib/ranking";

type Criterion = { id: string; name: string; weight: number; description: string; score: number; reason: string };
type Email = {
  kind: "invite" | "rejection";
  status: string;
  error: string | null;
  subject: string;
  body: string;
  sentAt: string | null;
  /** Actual delivery address (a configured test inbox overrides the CV address). */
  to: string;
  toAllowed: boolean;
};
type Props = {
  id: string;
  applied: Role;
  status: "processing" | "scored" | "failed";
  error: string | null;
  headline: string | null;
  fileUrl: string | null;
  pii: { name: string; email: string; phone: string; confirmed: boolean };
  totals: Record<Role, number | null>;
  rank: number | null;
  poolSize: number;
  aboveLine: boolean;
  brief: string | null;
  rubrics: { role: Role; criteria: Criterion[] }[];
  email: Email | null;
  queue: QueuePosition | null;
};

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";
const render = (t: string, n: string) => t.replace(/\{\{\s*first_name\s*\}\}/g, firstName(n));
const pad = (n: number) => String(n).padStart(2, "0");

function Section({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="label mb-3 border-b border-rule pb-2">{label}</div>
      {children}
    </section>
  );
}

export function CandidateView(p: Props) {
  const applied = p.rubrics.find((r) => r.role === p.applied)!;
  const other = p.rubrics.find((r) => r.role === otherRole(p.applied))!;
  // Draft edits live here so the decision bar sends exactly what is on screen.
  const [subject, setSubject] = useState(p.email?.subject ?? "");
  const [body, setBody] = useState(p.email?.body ?? "");

  return (
    <div className="space-y-10">
      {/* Queue context */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-small">
        <Link href={`/roles/${p.applied}`} className="text-muted hover:text-ink">
          Back to {p.applied} shortlist
        </Link>
        {p.queue && (
          <span className="font-mono tabular-nums text-muted">
            {pad(p.queue.position)} / {pad(p.queue.total)} · {p.queue.decided} decided
          </span>
        )}
      </div>

      {/* Identity + verdict */}
      <header className="grid grid-cols-12 gap-6 border-b-2 border-ink pb-8">
        <div className="col-span-12 md:col-span-8">
          <div className="label mb-2">Candidate · applied {p.applied}</div>
          <NameEditor id={p.id} name={p.pii.name} confirmed={p.pii.confirmed} />
          <p className="mt-2 max-w-[62ch] text-body text-ink-2">{p.headline}</p>
          <p className="mt-3 text-small text-muted">
            {p.pii.email || "no email"} · {p.pii.phone || "no phone"}
            {p.fileUrl && (
              <>
                {" · "}
                <a href={p.fileUrl} target="_blank" rel="noreferrer" className="text-sky underline">
                  original CV
                </a>
              </>
            )}
          </p>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          {p.status === "scored" ? (
            <>
              <div className="label mb-2">{p.applied} score</div>
              <div className={`font-mono text-h2 font-semibold tabular-nums md:text-display ${p.aboveLine ? "text-signal" : "text-coral-ink"}`}>
                {p.totals[p.applied]?.toFixed(0)}
                <span className="text-h3 text-muted">/100</span>
              </div>
              <div className={`mt-2 text-small font-medium ${p.aboveLine ? "text-signal" : "text-coral-ink"}`}>
                Rank {p.rank} of {p.poolSize} · {p.aboveLine ? `above the line (top ${SHORTLIST_SIZE})` : "below the line"}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="label"><span className={p.status === "failed" ? "attention" : ""}>{p.status}</span></div>
              {p.error && <p className="text-small text-ink-2">{p.error}</p>}
              <RetryButton id={p.id} />
            </div>
          )}
        </div>
      </header>

      {p.status === "scored" && (
        <>
          <Section label="Interview brief">
            {p.brief ? (
              <p className="max-w-[68ch] text-h3 font-normal leading-8 text-ink">{p.brief}</p>
            ) : (
              <div className="flex items-center gap-4 text-small text-muted">
                {p.aboveLine ? "Brief is being written…" : `Briefs are written automatically for the top ${SHORTLIST_SIZE}.`}
                <BriefButton id={p.id} role={p.applied} />
              </div>
            )}
          </Section>

          <div className="grid grid-cols-12 gap-x-10 gap-y-10">
            <Section label={<>Evidence · {p.applied} rubric · {p.totals[p.applied]?.toFixed(0)}/100</>} className="col-span-12 lg:col-span-7">
              <ol>
                {applied.criteria.map((c) => (
                  <li key={c.id} className="grid grid-cols-[1fr_auto] gap-x-6 border-b border-rule py-4 last:border-0">
                    <Tooltip title={c.description} placement="topLeft">
                      <span className="font-medium">
                        {c.name} <span className="font-mono text-small text-muted">{c.weight}%</span>
                      </span>
                    </Tooltip>
                    <span className="flex items-center gap-3">
                      <ScoreCells score={c.score} size="md" />
                      <span className="w-7 text-right font-mono text-small tabular-nums">{c.score}/5</span>
                    </span>
                    <p className="col-span-2 mt-1 max-w-[70ch] text-small text-ink-2">{c.reason}</p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section label={<>Other role · {other.role} rubric</>} className="col-span-12 lg:col-span-5">
              <div className="mb-4">
                <TotalBar total={p.totals[other.role]} />
              </div>
              <ol>
                {other.criteria.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 border-b border-rule py-2.5 last:border-0">
                    <Tooltip title={c.reason} placement="topLeft">
                      <span className="text-small">
                        {c.name} <span className="font-mono text-muted">{c.weight}%</span>
                      </span>
                    </Tooltip>
                    <ScoreCells score={c.score} />
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-label uppercase tracking-wider text-muted">Hover a criterion for the reason</p>
            </Section>
          </div>

          {p.email && <EmailBlock email={p.email} name={p.pii.name} to={p.email.to} cvEmail={p.pii.email} id={p.id} subject={subject} body={body} setSubject={setSubject} setBody={setBody} />}
        </>
      )}

      {p.status === "scored" && p.email && (
        <DecisionBar id={p.id} email={p.email} to={p.email.to} queue={p.queue} subject={subject} body={body} />
      )}
    </div>
  );
}

function NameEditor({ id, name, confirmed }: { id: string; name: string; confirmed: boolean }) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(!name);
  const [value, setValue] = useState(name);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-h2 font-semibold tracking-tight md:text-display">{name}</h1>
        <Button type="link" size="small" onClick={() => setEditing(true)}>
          Edit name
        </Button>
        {!confirmed && <span className="attention text-small">Name not found in CV text — check it</span>}
      </div>
    );
  }
  return (
    <div className="flex max-w-md gap-2">
      <Input size="large" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Candidate name" />
      <Button
        size="large"
        type="primary"
        loading={pending}
        disabled={!value.trim()}
        onClick={() =>
          start(async () => {
            const r = await saveName(id, value);
            if (r.ok) setEditing(false);
            else message.error(r.error);
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

function BriefButton({ id, role }: { id: string; role: Role }) {
  const { message } = App.useApp();
  const [pending, start] = useTransition();
  return (
    <Button
      size="small"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await makeBrief(id, role);
          if (!r.ok) message.error(r.error);
        })
      }
    >
      Write brief now
    </Button>
  );
}

function EmailBlock(props: {
  id: string;
  email: Email;
  name: string;
  to: string;
  cvEmail: string;
  subject: string;
  body: string;
  setSubject: (s: string) => void;
  setBody: (s: string) => void;
}) {
  const { message } = App.useApp();
  const { email, subject, body } = props;
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const locked = email.status === "sent" || email.status === "sending";
  const dirty = subject !== email.subject || body !== email.body;

  return (
    <Section
      label={
        <span className="flex items-baseline justify-between gap-4">
          <span>
            <span className={email.kind === "invite" ? "text-signal" : "text-coral-ink"}>{email.kind === "invite" ? "Interview invite" : "Rejection"}</span> · {email.status}
            {email.sentAt && ` ${new Date(email.sentAt).toLocaleString()}`}
          </span>
          <span className="normal-case tracking-normal">
            To {props.to || "—"}
            {props.to && props.cvEmail && props.to !== props.cvEmail && <span className="text-muted"> · test inbox (CV: {props.cvEmail})</span>}
          </span>
        </span>
      }
    >
      {email.status === "failed" && email.error && (
        <p className="mb-4 text-small"><span className="attention">Send failed</span> {email.error}</p>
      )}

      {editing && !locked ? (
        <div className="grid max-w-[80ch] gap-3">
          <Input value={subject} onChange={(e) => props.setSubject(e.target.value)} prefix={<span className="label mr-2">Subject</span>} />
          <Input.TextArea value={body} onChange={(e) => props.setBody(e.target.value)} autoSize={{ minRows: 12, maxRows: 24 }} className="font-mono !text-small" />
          <p className="text-small text-muted">{"{{first_name}}"} becomes “{firstName(props.name)}” when sent.</p>
          <div className="flex gap-2">
            <Button
              type="primary"
              disabled={!dirty}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveEmail(props.id, subject, body);
                  if (r.ok) {
                    message.success("Draft saved");
                    setEditing(false);
                  } else message.error(r.error);
                })
              }
            >
              Save draft
            </Button>
            <Button
              onClick={() => {
                props.setSubject(email.subject);
                props.setBody(email.body);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <article className="max-w-[68ch]">
          <h3 className="text-h3 font-medium">{subject}</h3>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-body text-ink-2">{render(body, props.name)}</pre>
          {!locked && (
            <Button className="mt-4" onClick={() => setEditing(true)}>
              Edit draft
            </Button>
          )}
        </article>
      )}
    </Section>
  );
}

/** Sticky triage bar: the one decision on this page, plus where to go next. */
function DecisionBar(props: { id: string; email: Email; to: string; queue: QueuePosition | null; subject: string; body: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { email, queue } = props;
  const sent = email.status === "sent";
  const nextHref = queue?.nextUndecidedId ? `/candidates/${queue.nextUndecidedId}` : null;
  const dirty = props.subject !== email.subject || props.body !== email.body;

  function send() {
    start(async () => {
      if (dirty) {
        const saved = await saveEmail(props.id, props.subject, props.body);
        if (!saved.ok) return void message.error(saved.error);
      }
      const r = await confirmSend(props.id);
      if (!r.ok) return void message.error(r.error, 8);
      message.success(`Sent to ${props.to}`);
      if (nextHref) router.push(nextHref); // triage: move straight to the next undecided candidate
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper/95 shadow-[0_-4px_0_rgba(17,17,17,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <Button disabled={!queue?.prevId} onClick={() => queue?.prevId && router.push(`/candidates/${queue.prevId}`)}>
            Previous
          </Button>
          <Button disabled={!queue?.nextId} onClick={() => queue?.nextId && router.push(`/candidates/${queue.nextId}`)}>
            Next
          </Button>
          {queue && (
            <span className="ml-2 hidden font-mono text-small tabular-nums text-muted sm:inline">
              {queue.decided}/{queue.total} decided
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {sent ? (
            <span className={`sticker mr-3 text-small ${email.kind === "invite" ? "bg-signal text-white" : "bg-coral text-ink"}`}>
              {email.kind === "invite" ? "Invite" : "Rejection"} sent
            </span>
          ) : (
            nextHref && (
              <Button type="text" onClick={() => router.push(nextHref)}>
                Skip for now
              </Button>
            )
          )}
          {sent ? (
            nextHref ? (
              <Button type="primary" size="large" onClick={() => router.push(nextHref)}>
                Next undecided
              </Button>
            ) : (
              <span className="sticker bg-sun text-small">
                All {queue?.total} decided
              </span>
            )
          ) : (
            <Popconfirm
              title={`Send this ${email.kind}?`}
              description={`To ${props.to}${nextHref ? " · then open the next undecided candidate" : ""}`}
              okText="Send"
              onConfirm={send}
              disabled={!email.toAllowed || email.status === "sending"}
            >
              <Button
                type="primary"
                size="large"
                className={email.kind === "rejection" ? "btn-coral" : ""}
                loading={pending}
                disabled={!email.toAllowed || email.status === "sending"}
              >
                Send {email.kind === "invite" ? "invite" : "rejection"}
              </Button>
            </Popconfirm>
          )}
        </div>
        {!email.toAllowed && (
          <p className="w-full text-right text-small"><span className="attention">Recipient is outside the allowed test domain</span></p>
        )}
      </div>
    </div>
  );
}
