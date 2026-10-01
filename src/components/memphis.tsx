// Memphis accent shapes. Decorative only (aria-hidden) and only used in chrome zones:
// page titles, drop zone, empty / done states. Never inside data (tables, scores, evidence).

const C = { ink: "#111111", coral: "#f25f4c", sun: "#ffd23f", sky: "#2563eb", green: "#15803d" };

type ShapeProps = { className?: string; color?: string };

export function Squiggle({ className, color = C.ink }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 120 24" fill="none">
      <path d="M2 12c8-10 16-10 24 0s16 10 24 0 16-10 24 0 16 10 24 0 16-10 20-4" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Zigzag({ className, color = C.ink }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 96 20" fill="none">
      <path d="M2 18 14 2l12 16L38 2l12 16L62 2l12 16L86 2l8 10" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Circle({ className, color = C.coral }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill={color} stroke={C.ink} strokeWidth="2.5" />
    </svg>
  );
}

export function Triangle({ className, color = C.sky }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 40 36">
      <path d="M20 3 37 33H3Z" fill={color} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function HalfCircle({ className, color = C.sun }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 48 26">
      <path d="M2 24a22 22 0 0 1 44 0Z" fill={color} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Dots({ className, color = C.ink }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 48 48">
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3].map((c) => <circle key={`${r}${c}`} cx={6 + c * 12} cy={6 + r * 12} r="2.6" fill={color} />))}
    </svg>
  );
}

export function Cross({ className, color = C.green }: ShapeProps) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 24 24" fill="none">
      <path d="M4 4l16 16M20 4 4 20" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const TITLE_SHAPE = {
  circle: (cls: string) => <Circle className={cls} color={C.sun} />,
  triangle: (cls: string) => <Triangle className={cls} color={C.coral} />,
  half: (cls: string) => <HalfCircle className={cls} color={C.sky} />,
};

/** Page title with a Memphis shape tucked behind its first letters. */
export function PageTitle({
  label,
  title,
  shape = "circle",
  size = "h2",
}: {
  label: React.ReactNode;
  title: React.ReactNode;
  shape?: keyof typeof TITLE_SHAPE;
  size?: "h2" | "display";
}) {
  return (
    <div>
      <div className="label mb-2">{label}</div>
      <h1 className={`relative isolate inline-block font-semibold tracking-tight ${size === "display" ? "text-h2 md:text-display" : "text-h2"}`}>
        {TITLE_SHAPE[shape]("absolute -top-5 -left-7 -z-10 h-10 w-10")}
        <span className="relative">{title}</span>
      </h1>
    </div>
  );
}

/** Empty / done state with confetti shapes. */
export function Celebration({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-2 border-ink bg-white px-6 py-10 text-center shadow-[4px_4px_0_#111]">
      <Circle className="absolute top-4 left-6 h-8 w-8" />
      <Triangle className="absolute bottom-5 left-16 h-9 w-10" color={C.sun} />
      <Squiggle className="absolute top-6 right-10 h-5 w-24" color={C.sky} />
      <Dots className="absolute right-6 bottom-4 h-12 w-12" color={C.coral} />
      <Cross className="absolute top-1/2 left-[22%] h-5 w-5" />
      <Zigzag className="absolute right-[24%] bottom-8 h-4 w-20" color={C.green} />
      <div className="relative text-h3 font-semibold">{title}</div>
      {children && <div className="relative mx-auto mt-2 max-w-[52ch] text-small text-ink-2">{children}</div>}
    </div>
  );
}
