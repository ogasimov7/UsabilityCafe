"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  // The most specific matching link is active, so "/designer" isn't lit up on "/designer/billing".
  const active = items
    .filter((n) => path === n.href || path.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {items.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={n.href === active ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            n.href === active ? "bg-ink text-white" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
