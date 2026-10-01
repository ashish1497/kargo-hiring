// Data-ink marks: the smallest visual that carries the number. Strength is colour-coded on a
// red → amber → green scale so the eye can scan a column; the number is always shown as well.

/** Strength colour stops, weakest to strongest (score 1..5). */
export const STRENGTH = ["#dc2626", "#f97316", "#eab308", "#65a30d", "#15803d"];
/** Darker shades of the same stops, for text (amber/lime fills are too light to read as text). */
const STRENGTH_TEXT = ["#b91c1c", "#c2410c", "#a16207", "#4d7c0f", "#15803d"];
const GRADIENT = `linear-gradient(90deg, ${STRENGTH.join(", ")})`;

/** Text colour for a 0–100 value on the strength scale. */
export function strengthColor(pct: number): string {
  const i = Math.round((Math.max(0, Math.min(100, pct)) / 100) * (STRENGTH.length - 1));
  return STRENGTH_TEXT[i];
}

/** Five cells filled up to the score (1–5), coloured by the score's strength. */
export function ScoreCells({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const cell = size === "md" ? "h-2.5 w-4" : "h-2 w-2.5";
  const color = STRENGTH[Math.max(0, Math.min(4, score - 1))];
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`${score} of 5`} title={`${score}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`${cell} ${i <= score ? "" : "bg-rule"}`} style={i <= score ? { background: color } : undefined} />
      ))}
    </span>
  );
}

/**
 * Total 0–100: number plus a bar whose fill is the red→green gradient across the full track,
 * revealed up to the value, so the bar's end colour shows its strength.
 */
export function TotalBar({ total }: { total: number | null }) {
  const v = Math.max(0, Math.min(100, total ?? 0));
  return (
    <span className="inline-flex w-full items-center gap-3">
      <span className="w-8 text-right font-mono text-body font-semibold tabular-nums" style={{ color: total == null ? undefined : strengthColor(v) }}>
        {total == null ? "–" : v.toFixed(0)}
      </span>
      <span className="relative h-[6px] flex-1 overflow-hidden bg-rule">
        <span
          className="absolute inset-y-0 left-0"
          style={{ width: `${v}%`, backgroundImage: GRADIENT, backgroundSize: `${v > 0 ? (100 / v) * 100 : 100}% 100%` }}
        />
      </span>
    </span>
  );
}

/** Email status as text; colour only when it means something. */
export function EmailStatus({ email }: { email: { kind: string; status: string } | null }) {
  if (!email) return <span className="text-small text-muted">drafting…</span>;
  if (email.status === "failed") return <span className="attention text-small">{email.kind} failed</span>;
  const kindTone = email.kind === "invite" ? "text-signal" : "text-coral-ink";
  const sent = email.status === "sent";
  return (
    <span className={`text-small ${kindTone} ${sent ? "font-semibold" : ""}`}>
      {email.kind} {sent ? "sent" : email.status === "draft" ? "draft" : email.status}
    </span>
  );
}
