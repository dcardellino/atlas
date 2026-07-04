"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// In-Page-Navigation für den Workout-Bereich. Die Sub-Routen bekommen bewusst
// KEINE Einträge in der globalen Bottom-Nav (die bliebe sonst überfüllt); der
// „Workout"-Tab dort bleibt via pathname.startsWith auf allen Sub-Routen aktiv.
const TABS = [
  { href: "/workouts", label: "Verlauf", exact: true },
  { href: "/workouts/stats", label: "Statistik", exact: false },
  { href: "/workouts/exercises", label: "Übungen", exact: false },
  { href: "/workouts/templates", label: "Vorlagen", exact: false },
] as const;

export default function WorkoutTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Workout-Navigation" className="mt-4 border-b border-border">
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
