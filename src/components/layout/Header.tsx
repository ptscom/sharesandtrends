import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/data", label: "Data" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-lg font-bold text-brand">
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
        <nav className="flex items-center gap-6 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted transition hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
