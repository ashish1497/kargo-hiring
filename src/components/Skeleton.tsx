// Zero-JS skeleton blocks in the same grid as the real pages, so navigation shows the layout instantly.

export function Bar({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse bg-rule ${className}`} />;
}

export function TitleSkeleton({ stats = false }: { stats?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 border-b border-rule pb-6">
      <div className="space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-72" />
      </div>
      {stats && (
        <div className="flex items-end gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-16" />
              <Bar className="h-6 w-12" />
            </div>
          ))}
          <Bar className="h-10 w-36" />
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      <div className="flex gap-6 border-b border-rule py-4">
        <Bar className="h-3 w-6" />
        <Bar className="h-3 w-24" />
        <Bar className="h-3 w-20" />
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className={`grid grid-cols-[48px_1fr] items-center gap-6 border-b py-5 md:grid-cols-[48px_1fr_150px_190px] xl:grid-cols-[48px_1fr_150px_repeat(5,92px)_56px_120px] ${r === 4 ? "border-b-2 border-b-signal" : "border-rule"}`}
        >
          <Bar className="h-3 w-6" />
          <div className="space-y-2">
            <Bar className="h-4 w-40" />
            <Bar className="h-3 w-full max-w-72" />
          </div>
          <Bar className="hidden h-2 w-full md:block" />
          <Bar className="hidden h-12 w-full md:block xl:hidden" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="hidden h-2 w-16 xl:block" />
          ))}
          <Bar className="hidden h-3 w-8 xl:block" />
          <Bar className="hidden h-3 w-20 xl:block" />
        </div>
      ))}
    </div>
  );
}
