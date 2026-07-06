"use client";

import { WORKOUT_MODES, WORKOUT_MODE_LABEL, type Exercise, type SetMetric } from "@/lib/workouts/types";
import { emptyBlock, type SetDraft, type BlockDraft } from "@/lib/workouts/draft";
import type { WorkoutMode } from "@/lib/workouts/types";
import { ModeConfig } from "./ModeConfig";
import { SetRow } from "./SetRow";

/**
 * Block-Karte: Modus-Dropdown (mit changeMode-Preset-Reset), Block-Name,
 * ModeConfig und die Satz-Liste. Entspricht einem Workout-Block im Logger.
 */
export function BlockCard({
  block,
  index,
  library,
  metricsFor,
  onPatch,
  onRemove,
  onPatchSet,
  onAddSet,
  onRemoveSet,
  onExerciseCreated,
}: {
  block: BlockDraft;
  index: number;
  library: Exercise[];
  metricsFor: (s: SetDraft) => SetMetric[];
  onPatch: (patch: Partial<BlockDraft>) => void;
  onRemove: () => void;
  onPatchSet: (sKey: string, patch: Partial<SetDraft>) => void;
  onAddSet: () => void;
  onRemoveSet: (sKey: string) => void;
  onExerciseCreated: (ex: Exercise) => void;
}) {
  function changeMode(mode: WorkoutMode) {
    const preset = emptyBlock(mode);
    // Config an den neuen Modus anpassen, Sätze behalten.
    onPatch({
      mode,
      interval_seconds: preset.interval_seconds,
      rest_seconds: preset.rest_seconds,
      rounds: preset.rounds,
    });
  }

  return (
    <div className="rounded-md border border-border bg-surface-raised p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
          Block {index + 1}
        </span>
        <select
          value={block.mode}
          onChange={(e) => changeMode(e.target.value as WorkoutMode)}
          className="ml-auto rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta uppercase tracking-label text-on-surface outline-none focus:border-accent"
          aria-label="Modus"
        >
          {WORKOUT_MODES.map((m) => (
            <option key={m} value={m}>
              {WORKOUT_MODE_LABEL[m]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Block entfernen"
          className="rounded-sm px-2 py-1 font-mono text-meta uppercase tracking-label text-danger transition-colors hover:underline"
        >
          ✕
        </button>
      </div>

      <input
        value={block.name}
        onChange={(e) => onPatch({ name: e.target.value })}
        placeholder="Block-Name (optional)"
        className="mt-2 w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-body-sm text-on-surface outline-none focus:border-accent"
      />

      <ModeConfig block={block} onPatch={onPatch} />

      {/* Sätze */}
      <ul className="mt-3 space-y-2">
        {block.sets.map((set, si) => (
          <SetRow
            key={set.key}
            set={set}
            index={si}
            metrics={metricsFor(set)}
            library={library}
            onPatch={(patch) => onPatchSet(set.key, patch)}
            onRemove={() => onRemoveSet(set.key)}
            onExerciseCreated={onExerciseCreated}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-2 font-mono text-meta uppercase tracking-label text-on-surface-muted transition-colors hover:text-accent"
      >
        + Satz
      </button>
    </div>
  );
}
