"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/backtest", label: "Backtest" },
  { href: "/strategies", label: "Strategies" },
  { href: "/scans", label: "Scans" },
  { href: "/data", label: "Data" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="ui-site-header">
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between px-5 md:px-10">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo.png"
            alt="Shares and Trends"
            width={220}
            height={52}
            priority
            className="h-9 w-auto md:h-10"
          />
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`ui-nav-link${active ? " ui-nav-link-active" : ""}`}
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
