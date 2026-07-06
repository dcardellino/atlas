"use client";

import type { Exercise, SetMetric } from "@/lib/workouts/types";
import type { SetDraft } from "@/lib/workouts/draft";
import { numInput } from "./fieldStyles";
import { ExercisePicker } from "./ExercisePicker";

/**
 * Eine Satz-Zeile innerhalb eines Blocks: Übungswahl, dynamische Metrik-Felder
 * (je nach metrics-Array) und Aufwärmen-Checkbox.
 */
export function SetRow({
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
  metrics: SetMetric[];
  library: Exercise[];
  onPatch: (patch: Partial<SetDraft>) => void;
  onRemove: () => void;
  onExerciseCreated: (ex: Exercise) => void;
}) {
  const numCls = numInput;
  const metricField: Record<SetMetric, keyof SetDraft> = {
    reps: "reps",
    weight: "weight_kg",
    distance: "distance_m",
    duration: "duration_seconds",
    calories: "calories",
  };
  const metricLabel: Record<SetMetric, string> = {
    reps: "Wdh.",
    weight: "kg",
    distance: "m",
    duration: "Sek.",
    calories: "kcal",
  };

  return (
    <li className="rounded-sm border border-border bg-surface p-2">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 font-mono text-meta text-on-surface-muted">
          {index + 1}
        </span>
        <ExercisePicker set={set} library={library} onPatch={onPatch} onExerciseCreated={onExerciseCreated} />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Satz entfernen"
          className="shrink-0 px-1 font-mono text-meta text-danger hover:underline"
        >
          ✕
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        {metrics.map((m) => (
          <label key={m} className="min-w-[68px] flex-1">
            <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
              {metricLabel[m]}
            </span>
            <input
              inputMode="decimal"
              value={set[metricField[m]] as string}
              onChange={(e) => onPatch({ [metricField[m]]: e.target.value })}
              className={numCls}
            />
          </label>
        ))}
        <label className="flex items-center gap-1 pb-1.5">
          <input
            type="checkbox"
            checked={set.is_warmup}
            onChange={(e) => onPatch({ is_warmup: e.target.checked })}
          />
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            Aufwärmen
          </span>
        </label>
      </div>
    </li>
  );
}
