"use client";

import { Button, Table, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import Link from "next/link";
import { EmailStatus, ScoreCells, TotalBar } from "@/components/marks";
import { Celebration, PageTitle } from "@/components/memphis";
import { RetryButton } from "@/components/RetryButton";
import { firstUndecided, otherRole, SHORTLIST_SIZE, type Role } from "@/lib/ranking";
import type { Row } from "@/lib/queries";

const ROLE_NAME: Record<Role, string> = { PM: "Product Manager", SPM: "Senior Product Manager" };
type Crit = { id: string; name: string; weight: number; description: string };

export function RoleShortlist({ role, criteria, ranked, pending }: { role: Role; criteria: Crit[]; ranked: Row[]; pending: Row[] }) {
  const other = otherRole(role);
  const decided = ranked.filter((r) => r.email?.status === "sent").length;
  const next = firstUndecided(ranked.map((r) => ({ id: r.id, decided: r.email?.status === "sent" })));
  const below = Math.max(0, ranked.length - SHORTLIST_SIZE);

  // Responsive by CSS only (no horizontal scroll, no hidden overflow):
  //   < md  : #, candidate (score + email shown inside the cell)
  //   md–lg : + score, compact rubric column (5 rows)
  //   lg–xl : + other-role score, email
  //   ≥ xl  : full per-criterion columns replace the compact rubric
  const columns: TableColumnsType<Row> = [
    {
      title: <span className="label">#</span>,
      dataIndex: "rank",
      width: 48,
      render: (v: number) => <span className="font-mono text-small text-muted tabular-nums">{String(v).padStart(2, "0")}</span>,
    },
    {
      title: <span className="label">Candidate</span>,
      key: "candidate",
      render: (_, r) => (
        <div className="min-w-[200px]">
          <Link href={`/candidates/${r.id}`} className="font-medium text-ink hover:underline">
            {r.name}
          </Link>
          <div className="text-small text-muted">{r.headline}</div>
          {r.otherRoleFit && <div className="mt-1 text-label uppercase tracking-wider text-ink-2">Also fits {other}</div>}
          <div className="mt-2 max-w-[220px] md:hidden">
            <TotalBar total={r.totals[role]} />
          </div>
          <div className="mt-1 lg:hidden">
            <EmailStatus email={r.email} />
          </div>
        </div>
      ),
    },
    {
      title: <span className="label">{role} score</span>,
      key: "total",
      width: 150,
      className: "hidden md:table-cell",
      render: (_, r) => <TotalBar total={r.totals[role]} />,
    },
    {
      title: <span className="label">Rubric</span>,
      key: "rubric-compact",
      width: 190,
      className: "hidden md:table-cell xl:hidden",
      render: (_, r) => (
        <ul className="space-y-1">
          {criteria.map((c, i) => (
            <li key={c.id} className="flex items-center justify-between gap-3 text-label text-ink-2">
              <Tooltip title={c.description}>
                <span className="truncate">{c.name}</span>
              </Tooltip>
              <ScoreCells score={r.criterionScores[role][i]} />
            </li>
          ))}
        </ul>
      ),
    },
    ...criteria.map((c, i) => ({
      title: (
        <Tooltip title={c.description}>
          <span className="label block leading-tight normal-case tracking-normal">
            {c.name}
            <span className="block font-mono text-muted">{c.weight}%</span>
          </span>
        </Tooltip>
      ),
      key: c.id,
      width: 92,
      className: "hidden xl:table-cell",
      render: (_: unknown, r: Row) => <ScoreCells score={r.criterionScores[role][i]} />,
    })),
    {
      title: <span className="label">{other}</span>,
      key: "other",
      width: 56,
      align: "right",
      className: "hidden lg:table-cell",
      render: (_, r) => <span className="font-mono text-small text-muted tabular-nums">{r.totals[other]?.toFixed(0)}</span>,
    },
    {
      title: <span className="label">Email</span>,
      key: "email",
      width: 120,
      className: "hidden lg:table-cell",
      render: (_, r) => <EmailStatus email={r.email} />,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b border-rule pb-6">
        <PageTitle label={<>Shortlist · {role}</>} title={ROLE_NAME[role]} shape={role === "PM" ? "triangle" : "half"} />
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <dl className="flex gap-8">
            {[
              ["Scored", ranked.length],
              ["Shortlisted", Math.min(SHORTLIST_SIZE, ranked.length)],
              ["Decided", `${decided}/${ranked.length}`],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="label">{k}</dt>
                <dd className="font-mono text-h3 tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {next ? (
            <Link href={`/candidates/${next}`}>
              <Button type="primary" size="large">
                {decided ? "Continue review" : "Start review"}
              </Button>
            </Link>
          ) : ranked.length ? (
            <span className="sticker bg-signal text-white">All decided</span>
          ) : null}
        </div>
      </div>

      <Table<Row>
        rowKey="id"
        columns={columns}
        dataSource={ranked}
        pagination={false}
        tableLayout="auto"
        rowClassName={(r) => [r.rank === SHORTLIST_SIZE ? "shortlist-cut" : "", r.aboveLine ? "" : "below-line"].join(" ")}
        locale={{
          emptyText: (
            <div className="py-6">
              <Celebration title={`No ${role} candidates yet`}>
                <Link href="/">Upload CVs</Link> to build this shortlist.
              </Celebration>
            </div>
          ),
        }}
      />

      {ranked.length > 0 && (
        <p className="mt-3 text-small text-muted">
          <span className="mr-2 inline-block h-[2px] w-6 translate-y-[-3px] bg-signal" />
          Top {SHORTLIST_SIZE} above the line get an interview brief and an invite draft · {below} below get a rejection draft ·
          nothing is sent until you confirm. <Link href={`/roles/${other}`}>Open {other} shortlist</Link>
        </p>
      )}

      {pending.length > 0 && (
        <section className="mt-10">
          <div className="label mb-2 border-b border-rule pb-2">Not scored</div>
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 border-b border-rule py-3">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-small text-ink-2">
                  <span className={r.status === "failed" ? "attention" : ""}>{r.status}</span>
                  {r.error ? ` — ${r.error}` : ""}
                </div>
              </div>
              <RetryButton id={r.id} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
