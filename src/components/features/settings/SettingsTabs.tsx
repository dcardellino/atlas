"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// In-Page-Navigation für den Settings-Bereich (analog zu WorkoutTabs). Areas
// zieht hierher um und verliert dafür seinen Eintrag in der globalen Bottom-Nav.
const TABS = [
  { href: "/settings/integrations", label: "Integrationen", exact: true },
  { href: "/settings/tokens", label: "Tokens", exact: false },
  { href: "/settings/insights", label: "Insights", exact: false },
  { href: "/settings/reminders", label: "Erinnerungen", exact: false },
  { href: "/settings/areas", label: "Areas", exact: false },
] as const;

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings-Navigation" className="mt-4 border-b border-border">
      <ul className="flex flex-wrap gap-4">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 py-2 font-mono text-label uppercase tracking-label transition-colors ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-on-surface-muted hover:text-on-surface"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
