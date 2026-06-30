"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/areas", label: "Areas" },
  { href: "/routines", label: "Routines" },
  { href: "/journal", label: "Journal" },
  { href: "/settings", label: "Settings" },
] as const;

// Mobile-first bottom navigation. Labels use the mono `meta` token (the system
// signature). Active item carries the rust accent; the rest stay muted taupe.
export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="sticky bottom-0 z-10 border-t border-border bg-surface"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] items-center justify-center px-1 py-3 font-mono text-meta uppercase tracking-label transition-colors ${
                  active
                    ? "text-accent"
                    : "text-on-surface-muted hover:text-on-surface"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
