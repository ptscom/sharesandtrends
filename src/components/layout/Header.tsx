"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/strategies", label: "Strategies" },
  { href: "/scans", label: "Scans" },
  { href: "/data", label: "Data" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-foreground shadow-sm">
            ST
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink">
              Shares & Trends
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted">
              Explore · Backtest · Share
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 transition ${
                  active
                    ? "font-semibold text-ink underline decoration-brand decoration-2 underline-offset-4"
                    : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
