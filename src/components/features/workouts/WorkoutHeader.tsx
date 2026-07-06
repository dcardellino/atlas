import Link from "next/link";
import WorkoutTabs from "@/components/features/workouts/WorkoutTabs";

/**
 * Gemeinsamer Kopf des Workout-Bereichs: Mono-Eyebrow, große Serif-Headline,
 * optionale Aktion rechts, darunter die In-Page-Tabs (docs/design.md § Seiten
 * folgen einem festen Muster). Rein präsentational — kein Client nötig.
 */
export default function WorkoutHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <header>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Training
          </p>
          <h1 className="mt-1 font-serif text-display text-on-surface">{title}</h1>
        </div>
        {action && (
          <Link
            href={action.href}
            className="h-11 whitespace-nowrap rounded-sm bg-on-surface px-4 font-mono text-label uppercase leading-[44px] tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
          >
            {action.label}
          </Link>
        )}
      </div>
      <WorkoutTabs />
    </header>
  );
}
