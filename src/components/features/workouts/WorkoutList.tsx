"use client";

import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { WORKOUT_TYPE_LABEL, type Workout } from "@/lib/workouts/types";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Workout-Verlauf (TASK — Workout-Tracker). Read-only Liste, nach performed_on
 * absteigend. Jede Zeile verlinkt auf die Detail-/Editier-Ansicht. Anlegen läuft
 * über den „Neu"-Button im Header (WorkoutHeader).
 */

const TZ = "Europe/Berlin";

function formatDate(isoDate: string): string {
  // performed_on ist ein reines Datum; als lokale Mittagszeit formatieren, damit
  // keine Zeitzonenverschiebung den Tag kippt.
  return formatInTimeZone(`${isoDate}T12:00:00Z`, TZ, "EEE, d. MMM yyyy");
}

export default function WorkoutList({ workouts }: { workouts: Workout[] }) {
  if (workouts.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title="Noch keine Workouts"
          hint="Protokolliere dein erstes Training – Kraft oder Hyrox."
        />
      </div>
    );
  }

  return (
    <ul className="mt-6">
      {workouts.map((w) => (
        <li key={w.id} className="border-b border-border">
          <Link
            href={`/workouts/${w.id}`}
            className="flex items-baseline justify-between gap-3 py-3 transition-colors hover:text-accent"
          >
            <div className="min-w-0">
              <p className="truncate text-body text-on-surface">
                {w.title || WORKOUT_TYPE_LABEL[w.type]}
              </p>
              <p className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
                {formatDate(w.performed_on)}
              </p>
            </div>
            <span className="shrink-0 font-mono text-meta uppercase tracking-label text-on-surface-muted">
              {WORKOUT_TYPE_LABEL[w.type]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
