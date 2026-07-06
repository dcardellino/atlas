"use client";

import { useState } from "react";
import {
  formatTime,
  toInt,
  parseTime,
  type SetDraft,
} from "@/lib/workouts/draft";
import type { Exercise, SetMetric } from "@/lib/workouts/types";
import type { WorkoutDraft } from "../useWorkoutDraft";
import { ExercisePicker } from "../ExercisePicker";
import { numInput, fieldLabel } from "../fieldStyles";

// Metrik-Label und Feld-Mapping (identisch zu StrengthLogger/SetRow)
const metricLabel: Record<SetMetric, string> = {
  reps: "Wdh.",
  weight: "kg",
  distance: "m",
  duration: "Sek.",
  calories: "kcal",
};

const metricField: Record<SetMetric, keyof SetDraft> = {
  reps: "reps",
  weight: "weight_kg",
  distance: "distance_m",
  duration: "duration_seconds",
  calories: "calories",
};

/**
 * Einzelne Segment-Zeile: Übungs-Picker, Split-Zeit (mm:ss, lokaler State),
 * optionale Stationsmetriken (ohne "duration" — das ist die Split-Zeit),
 * Entfernen-Button.
 *
 * Lokaler Split-State: set.duration_seconds ist in der Draft immer eine reine
 * Sekunden-Zeichenkette (z. B. "750"); formatTime wandelt sie in "12:30" um.
 * Änderungen schreiben die Sekunden zurück (parseTime("12:30") === 750).
 * Dadurch bleibt die Draft-Repr. kompatibel zu blocksToInput und der Round-Trip
 * nach dem Laden zeigt immer mm:ss.
 */
function SegmentRow({
  set,
  index,
  metrics,
  library,
  onPatch,
  onRemove,
  onExerciseCreated,
}: {
  set: SetDraft;
  index: number;
  metrics: SetMetric[]; // bereits ohne "duration" (= Split-Feld)
  library: Exercise[];
  onPatch: (patch: Partial<SetDraft>) => void;
  onRemove: () => void;
  onExerciseCreated: (ex: Exercise) => void;
}) {
  // Lokaler mm:ss-Display-State; initialisiert aus den gespeicherten Sekunden
  const [split, setSplit] = useState(formatTime(toInt(set.duration_seconds)));

  return (
    <li className="rounded-sm border border-border bg-surface p-2">
      <div className="flex items-center gap-2">
        {/* Segment-Nummer */}
        <span className="w-5 shrink-0 font-mono text-meta text-on-surface-muted">
          {index + 1}
        </span>

        {/* Übungswahl: Lauf-Leg oder Station */}
        <ExercisePicker
          set={set}
          library={library}
          onPatch={onPatch}
          onExerciseCreated={onExerciseCreated}
        />

        {/* Split-Zeit im mm:ss-Format */}
        <label className="flex w-24 shrink-0 flex-col">
          <span className={fieldLabel}>Split</span>
          <input
            aria-label="Split (mm:ss)"
            value={split}
            onChange={(e) => {
              const v = e.target.value;
              setSplit(v);
              // Sekunden zurückschreiben (kompatibel zu blocksToInput/parseTime)
              const parsed = parseTime(v);
              onPatch({ duration_seconds: parsed != null ? String(parsed) : "" });
            }}
            placeholder="mm:ss"
            className={numInput}
          />
        </label>

        {/* Segment entfernen */}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Segment entfernen"
          className="shrink-0 px-1 font-mono text-meta text-danger hover:underline"
        >
          ✕
        </button>
      </div>

      {/* Optionale Stationsmetriken (Distanz, Gewicht, Kalorien — ohne duration) */}
      {metrics.length > 0 && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          {metrics.map((m) => (
            <label key={m} className="min-w-[68px] flex-1">
              <span className={fieldLabel}>{metricLabel[m]}</span>
              <input
                inputMode="decimal"
                value={set[metricField[m]] as string}
                onChange={(e) => onPatch({ [metricField[m]]: e.target.value })}
                className={numInput}
              />
            </label>
          ))}
        </div>
      )}
    </li>
  );
}

/**
 * Hyrox-Body: ein for_time-Block mit geordneter Segment-Sequenz (Lauf ↔ Station).
 * Pro Segment: Übungswahl (ExercisePicker), Split-Zeit (mm:ss), optionale
 * Stationsmetriken. Gesamtzeit liegt auf block.result_seconds.
 *
 * Legacy-tolerant:
 * - 0 Blöcke → null (kein Crash)
 * - mehrere Blöcke → ersten Block verwenden
 * - 0 Sätze → leere Liste + "+ Segment"-Button
 * - null exercise_id / exercise_name → kein Crash (ExercisePicker zeigt "Übung wählen…")
 */
export function HyroxLogger({ draft }: { draft: WorkoutDraft }) {
  const {
    blocks,
    library,
    metricsFor,
    patchBlock,
    patchSet,
    addSet,
    removeSet,
    onExerciseCreated,
  } = draft;

  // Erster Block = Hyrox for_time-Block; bei 0 Blöcken nicht rendern
  const block = blocks[0];
  if (!block) return null;

  return (
    <div>
      {/* Gesamtzeit: prominent oben, mm:ss → result_seconds */}
      <div className="mt-4">
        <label>
          <span className={fieldLabel}>Gesamtzeit (mm:ss)</span>
          <input
            aria-label="Gesamtzeit (mm:ss)"
            value={block.result_seconds}
            onChange={(e) =>
              patchBlock(block.key, { result_seconds: e.target.value })
            }
            placeholder="z. B. 1:02:30"
            className={numInput}
          />
        </label>
      </div>

      {/* Segment-Sequenz: Lauf ↔ Station */}
      <ul className="mt-4 space-y-2">
        {block.sets.map((set, si) => {
          // Stationsmetriken ohne "duration" (duration = Split-Feld oben)
          const metrics = metricsFor(set).filter((m) => m !== "duration");
          return (
            <SegmentRow
              key={set.key}
              set={set}
              index={si}
              metrics={metrics}
              library={library}
              onPatch={(patch) => patchSet(block.key, set.key, patch)}
              onRemove={() => removeSet(block.key, set.key)}
              onExerciseCreated={onExerciseCreated}
            />
          );
        })}
      </ul>

      {/* + Segment: leeres Segment, Übung über Picker wählbar */}
      <button
        type="button"
        onClick={() => addSet(block.key)}
        className="mt-4 h-11 w-full rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
      >
        + Segment
      </button>
    </div>
  );
}
