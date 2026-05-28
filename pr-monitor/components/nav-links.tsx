"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/journalists", label: "Journalists" },
  { href: "/trends", label: "Trends" },
  { href: "/config/feeds", label: "Feeds" },
  { href: "/config/patterns", label: "Patterns" },
  { href: "/config/blocklist", label: "Blocklist" },
];

export function NavLinks() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-6 text-[11px] font-sans font-medium uppercase tracking-label">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "transition-colors hover:text-accent " +
              (active
                ? "text-ink border-b-2 border-accent pb-1 -mb-px"
                : "text-ink")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
