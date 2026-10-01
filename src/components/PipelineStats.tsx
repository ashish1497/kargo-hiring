// Plain definition list: numbers carry the meaning, so no chrome around them.
export function PipelineStats({ pm, spm, failed, sent }: { pm: number; spm: number; failed: number; sent: number }) {
  const rows: [string, number, string?][] = [
    ["PM scored", pm],
    ["SPM scored", spm],
    ["Emails sent", sent, sent ? "text-signal" : ""],
    ["Failed", failed, failed ? "attention" : ""],
  ];
  return (
    <aside>
      <div className="label mb-3 border-b border-rule pb-2">Pipeline</div>
      <dl>
        {rows.map(([k, v, tone]) => (
          <div key={k} className="flex items-baseline justify-between border-b border-rule py-3">
            <dt className="text-small text-ink-2">{k}</dt>
            <dd className={`font-mono text-h3 tabular-nums ${tone ?? ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
