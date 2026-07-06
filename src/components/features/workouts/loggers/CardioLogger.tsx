"use client";

import { formatTime, toInt, parseTime, type SetDraft } from "@/lib/workouts/draft";
import type { Exercise } from "@/lib/workouts/types";
import type { WorkoutDraft } from "../useWorkoutDraft";
import { ExercisePicker } from "../ExercisePicker";
import { numInput, fieldLabel } from "../fieldStyles";
import { TimeField } from "../TimeField";

/**
 * Einzelne Intervall-Zeile: Aktivitäts-Picker, Distanz (m), Dauer (mm:ss),
 * abgeleitete Pace (min/km, nur Anzeige), Entfernen-Button.
 *
 * Pace wird nur angezeigt, wenn Distanz > 0 und Dauer > 0.
 * canRemove steuert, ob „✕" aktiv ist (mindestens ein Intervall muss bleiben).
 */
function IntervalRow({
  set,
  index,
  canRemove,
  library,
  onPatch,
  onRemove,
  onExerciseCreated,
}: {
  set: SetDraft;
  index: number;
  canRemove: boolean;
  library: Exercise[];
  onPatch: (patch: Partial<SetDraft>) => void;
  onRemove: () => void;
  onExerciseCreated: (ex: Exercise) => void;
}) {
  // Abgeleitete Pace berechnen — nie speichern
  const distM = toInt(set.distance_m);
  const durSec = parseTime(set.duration_seconds);
  let pace: string | null = null;
  if (distM != null && distM > 0 && durSec != null && durSec > 0) {
    const paceSecPerKm = durSec / (distM / 1000);
    pace = formatTime(Math.round(paceSecPerKm)) + " /km";
  }

  return (
    <li className="rounded-sm border border-border bg-surface p-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Intervall-Nummer */}
        <span className="w-5 shrink-0 font-mono text-meta text-on-surface-muted">
          {index + 1}
        </span>

        {/* Aktivitätswahl: Laufen, Radfahren, Rudern … */}
        <ExercisePicker
          set={set}
          library={library}
          onPatch={onPatch}
          onExerciseCreated={onExerciseCreated}
        />

        {/* Distanz in Metern */}
        <label className="flex w-20 shrink-0 flex-col">
          <span className={fieldLabel}>Distanz (m)</span>
          <input
            inputMode="numeric"
            aria-label="Distanz (m)"
            value={set.distance_m}
            onChange={(e) => onPatch({ distance_m: e.target.value })}
            placeholder="m"
            className={numInput}
          />
        </label>

        {/* Dauer im mm:ss-Format — nutzt das geteilte TimeField-Atom */}
        <label className="flex w-24 shrink-0 flex-col">
          <span className={fieldLabel}>Dauer (mm:ss)</span>
          <TimeField
            ariaLabel="Dauer (mm:ss)"
            value={set.duration_seconds}
            onChange={(secs) => onPatch({ duration_seconds: secs })}
          />
        </label>

        {/* Pace (abgeleitet, read-only) — nur wenn Distanz und Dauer vorhanden */}
        {pace != null && (
          <span
            aria-label="Pace"
            className="shrink-0 font-mono text-meta text-on-surface-muted"
          >
            {pace}
          </span>
        )}

        {/* Intervall entfernen — deaktiviert wenn nur ein Intervall übrig */}
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Intervall entfernen"
          className="ml-auto shrink-0 px-1 font-mono text-meta text-danger hover:underline disabled:opacity-30"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/**
 * Cardio-Body: ein straight-Block, dessen Sätze Intervalle sind (Distanz + Dauer + Pace).
 * Kein Modus, kein RPE. Pace ist abgeleitet und wird niemals gespeichert.
 *
 * Legacy-tolerant:
 * - 0 Blöcke → null (kein Crash)
 * - mehrere Blöcke → ersten Block verwenden
 * - 0 Sätze → leere Liste + „+ Intervall"-Button
 * - null exercise_id / exercise_name → kein Crash (ExercisePicker zeigt „Übung wählen…")
 * - fehlende Distanz oder Dauer → keine Pace-Anzeige
 */
export function CardioLogger({ draft }: { draft: WorkoutDraft }) {
  const { blocks, library, patchSet, addSet, removeSet, onExerciseCreated } =
    draft;

  // Erster Block = Cardio straight-Block; bei 0 Blöcken nicht rendern
  const block = blocks[0];
  if (!block) return null;

  return (
    <div>
      <ul className="mt-4 space-y-2">
        {block.sets.map((set, si) => (
          <IntervalRow
            key={set.key}
            set={set}
            index={si}
            canRemove={block.sets.length > 1}
            library={library}
            onPatch={(patch) => patchSet(block.key, set.key, patch)}
            onRemove={() => removeSet(block.key, set.key)}
            onExerciseCreated={onExerciseCreated}
          />
        ))}
      </ul>

      {/* Weiteres Intervall hinzufügen */}
      <button
        type="button"
        onClick={() => addSet(block.key)}
        className="mt-4 h-11 w-full rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
      >
        + Intervall
      </button>
    </div>
  );
}
