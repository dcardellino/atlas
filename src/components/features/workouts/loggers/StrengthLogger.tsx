"use client";

import { emptySet, type SetDraft, type BlockDraft } from "@/lib/workouts/draft";
import type { SetMetric } from "@/lib/workouts/types";
import type { WorkoutDraft } from "../useWorkoutDraft";
import { ExercisePicker } from "../ExercisePicker";
import { numInput } from "../fieldStyles";

// Metrik-Maps (identisch zu SetRow — kein Export nötig, da nur zwei Stellen)
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

/**
 * Leitet die Kartenübung aus dem ersten Satz ab. Gibt einen leeren Satz zurück
 * wenn der Block keine Sätze hat (0-Satz-Blöcke: nur Picker + „+ Satz").
 */
function cardSetFor(block: BlockDraft): SetDraft {
  return block.sets[0] ?? emptySet();
}

/**
 * Kraft-Satz-Zeile: Satznr., dynamische Metrik-Felder, RPE-Feld, Aufwärmen-Checkbox,
 * Entfernen-Button. Keine Übungswahl — die Übung lebt im Kartenkopf.
 */
function StrengthSetRow({
  set,
  index,
  metrics,
  onPatch,
  onRemove,
}: {
  set: SetDraft;
  index: number;
  metrics: SetMetric[];
  onPatch: (patch: Partial<SetDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-sm border border-border bg-surface p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="w-5 shrink-0 font-mono text-meta text-on-surface-muted">
          {index + 1}
        </span>
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
              className={numInput}
            />
          </label>
        ))}
        {/* RPE-Feld: Perceived Exertion auf der Rate-of-Perceived-Exertion-Skala */}
        <label className="min-w-[68px] flex-1">
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            RPE
          </span>
          <input
            inputMode="decimal"
            value={set.rpe}
            onChange={(e) => onPatch({ rpe: e.target.value })}
            className={numInput}
            aria-label="RPE"
          />
        </label>
        {/* Aufwärmen-Checkbox */}
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

/**
 * Kraft-Body: eine Übungskarte pro Block — Übung im Kartenkopf, darunter
 * Sätze mit Wdh × Gewicht × RPE × Aufwärmen. Kein Modus-Dropdown, kein
 * ModeConfig. Legacy-tolerant: Kartenkopf zeigt Übung des ersten Satzes;
 * Blöcke mit 0 Sätzen und gemischte Übungen rendern ohne Crash.
 */
export function StrengthLogger({ draft }: { draft: WorkoutDraft }) {
  const {
    blocks,
    library,
    metricsFor,
    patchBlock,
    removeBlock,
    patchSet,
    addSet,
    removeSet,
    onExerciseCreated,
    addBlock,
  } = draft;

  return (
    <div>
      <div className="mt-8 space-y-4">
        {blocks.map((block) => {
          // Kartenübung = erster Satz (Legacy-tolerant; leer bei 0 Sätzen)
          const cardSet = cardSetFor(block);
          const cardExerciseId = cardSet.exercise_id;
          const cardExerciseName = cardSet.exercise_name;

          /**
           * Übungswahl im Kartenkopf gilt für alle Sätze: exercise_id +
           * exercise_name auf jeden Satz kopieren und als block.name spiegeln.
           */
          function handleExercisePatch(patch: Partial<SetDraft>) {
            const exercise_id = patch.exercise_id ?? null;
            const exercise_name = patch.exercise_name ?? "";
            patchBlock(block.key, {
              name: exercise_name,
              sets: (block.sets.length ? block.sets : [emptySet()]).map((s) => ({
                ...s,
                exercise_id,
                exercise_name,
              })),
            });
          }

          return (
            <div
              key={block.key}
              className="rounded-md border border-border bg-surface-raised p-3"
            >
              {/* Kartenkopf: Übungswahl (Karte gesamt) + Entfernen */}
              <div className="flex items-center gap-2">
                <ExercisePicker
                  set={cardSet}
                  library={library}
                  onPatch={handleExercisePatch}
                  onExerciseCreated={onExerciseCreated}
                />
                <button
                  type="button"
                  onClick={() => removeBlock(block.key)}
                  aria-label="Übung entfernen"
                  className="shrink-0 rounded-sm px-2 py-1 font-mono text-meta uppercase tracking-label text-danger transition-colors hover:underline"
                >
                  ✕
                </button>
              </div>

              {/* Satz-Liste */}
              <ul className="mt-3 space-y-2">
                {block.sets.map((set, si) => (
                  <StrengthSetRow
                    key={set.key}
                    set={set}
                    index={si}
                    metrics={metricsFor(set)}
                    onPatch={(patch) => patchSet(block.key, set.key, patch)}
                    onRemove={() => removeSet(block.key, set.key)}
                  />
                ))}
              </ul>

              {/* + Satz: neuer Satz erbt die Kartenübung */}
              <button
                type="button"
                onClick={() =>
                  addSet(block.key, {
                    exercise_id: cardExerciseId,
                    exercise_name: cardExerciseName,
                  })
                }
                className="mt-2 font-mono text-meta uppercase tracking-label text-on-surface-muted transition-colors hover:text-accent"
              >
                + Satz
              </button>
            </div>
          );
        })}
      </div>

      {/* + Übung: neuer Block (Modus = straight, kein Modusselektor) */}
      <button
        type="button"
        onClick={() => addBlock("straight")}
        className="mt-4 h-11 w-full rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
      >
        + Übung
      </button>
    </div>
  );
}
