"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Upload", match: (p: string) => p === "/" },
  { href: "/roles/PM", label: "PM shortlist", match: (p: string) => p.startsWith("/roles/PM") },
  { href: "/roles/SPM", label: "SPM shortlist", match: (p: string) => p.startsWith("/roles/SPM") },
];

export function AppHeader() {
  const path = usePathname();
  return (
    <header className="relative overflow-hidden border-b-2 border-ink bg-paper">
      <div className="relative mx-auto flex max-w-[1440px] flex-wrap items-baseline gap-x-10 gap-y-2 px-6 pt-5 pb-3">
        <Link href="/" className="whitespace-nowrap text-h3 font-semibold tracking-tight text-ink">
          Kargo<span className="text-muted"> / Hiring</span>
        </Link>
        <nav className="flex gap-6 text-small">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-0.5 pb-0.5 ${n.match(path) ? "nav-active font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
