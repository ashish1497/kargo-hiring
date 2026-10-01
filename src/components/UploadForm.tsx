"use client";

import { Button, Listy, Progress, Segmented, Upload } from "antd";
import type { UploadFile } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Celebration } from "@/components/memphis";
import { TOKENS } from "@/components/Providers";

type Item = { name: string; state: "queued" | "working" | "done" | "failed"; error?: string };
type RoleChoice = "PM" | "SPM";

const CONCURRENCY = 3;
const STATE: Record<Item["state"], { tone: string; label: string }> = {
  queued: { tone: "text-muted", label: "queued" },
  working: { tone: "text-ink", label: "reading + scoring…" },
  done: { tone: "text-signal font-medium", label: "scored" },
  failed: { tone: "attention", label: "failed" },
};

export function UploadForm() {
  const router = useRouter();
  const [role, setRole] = useState<RoleChoice>("PM");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"idle" | "scoring" | "drafting" | "done">("idle");
  const [draft, setDraft] = useState<{ total: number; remaining: number; error?: string }>({ total: 0, remaining: 0 });

  const update = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function run() {
    const list = files.map((f) => f.originFileObj as File).filter(Boolean);
    if (!list.length) return;
    setItems(list.map((f) => ({ name: f.name, state: "queued" })));
    setPhase("scoring");

    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
        while (next < list.length) {
          const i = next++;
          update(i, { state: "working" });
          const body = new FormData();
          body.set("file", list[i]);
          body.set("role", role);
          try {
            const res = await fetch("/api/candidates", { method: "POST", body });
            const json = await res.json().catch(() => ({}));
            update(i, res.ok ? { state: "done" } : { state: "failed", error: json.error ?? `HTTP ${res.status}` });
          } catch (e) {
            update(i, { state: "failed", error: (e as Error).message });
          }
        }
      }),
    );

    // Briefs + draft emails follow the new ranking; the server works through them in batches.
    setPhase("drafting");
    let total = 0;
    for (let pass = 0; pass < 20; pass++) {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDraft((d) => ({ ...d, error: json.error ?? "Drafting failed" }));
        break;
      }
      total = Math.max(total, json.done + json.remaining);
      setDraft({ total, remaining: json.remaining });
      if (!json.remaining) break;
      if (json.done === 0) {
        setDraft({ total, remaining: json.remaining, error: json.errors?.[0] ?? "Drafting is stuck" });
        break;
      }
    }
    setPhase("done");
    setFiles([]);
    router.refresh();
  }

  const busy = phase === "scoring" || phase === "drafting";
  const scored = items.filter((i) => i.state === "done" || i.state === "failed").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="label mb-2">Applied for</div>
        <Segmented<RoleChoice>
          value={role}
          disabled={busy}
          onChange={setRole}
          options={[
            { label: "Product Manager", value: "PM" },
            { label: "Senior Product Manager", value: "SPM" },
          ]}
        />
      </div>

      <Upload.Dragger
        className="memphis-drop"
        multiple
        accept=".pdf,.docx"
        disabled={busy}
        fileList={files}
        beforeUpload={() => false}
        onChange={({ fileList }) => setFiles(fileList)}
      >
        <div className="py-6">
          <div className="text-h3 font-medium">Drop CVs here</div>
          <div className="mt-1 text-small text-muted">or click to choose · PDF or DOCX · up to 4 MB each</div>
        </div>
      </Upload.Dragger>

      <Button type="primary" size="large" loading={busy} disabled={!files.length} onClick={run}>
        Process {files.length || ""} CV{files.length === 1 ? "" : "s"}
        {` as ${role}`}
      </Button>

      {items.length > 0 && (
        <section>
          <div className="label mb-3 border-b border-rule pb-2">Progress</div>
          <div className="grid grid-cols-[120px_1fr] items-center gap-x-4 gap-y-1 text-small">
            <span className="text-ink-2">Scored</span>
            <Progress percent={Math.round((scored / items.length) * 100)} strokeColor={TOKENS.ink} railColor={TOKENS.rule} size="small" format={() => `${scored}/${items.length}`} />
            {phase !== "scoring" && (
              <>
                <span className="text-ink-2">Briefs + emails</span>
                <Progress
                  percent={draft.total ? Math.round(((draft.total - draft.remaining) / draft.total) * 100) : phase === "done" ? 100 : 0}
                  strokeColor={draft.error ? TOKENS.alert : TOKENS.ink}
                  railColor={TOKENS.rule}
                  size="small"
                  format={(pct) => `${pct}%`}
                />
              </>
            )}
          </div>
          {draft.error && <p className="mt-2 text-small"><span className="attention">{draft.error}</span></p>}

          <div className="mt-4 border-t border-rule">
            <Listy<Item>
              items={items}
              rowKey="name"
              itemRender={(it) => (
                <div className="flex items-baseline justify-between gap-3 border-b border-rule py-2 text-small">
                  <div className="min-w-0">
                    <div className="truncate">{it.name}</div>
                    {it.error && <div className="text-ink-2">{it.error}</div>}
                  </div>
                  <span className={`shrink-0 ${STATE[it.state].tone}`}>{STATE[it.state].label}</span>
                </div>
              )}
            />
          </div>

          {phase === "done" && (
            <div className="mt-6">
              <Celebration title="Shortlists updated">
                Review the <Link href="/roles/PM">PM</Link> or <Link href="/roles/SPM">SPM</Link> shortlist.
              </Celebration>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
