"use client";

import type { WorkoutMode } from "@/lib/workouts/types";
import type { WorkoutDraft } from "../useWorkoutDraft";
import { BlockCard } from "../BlockCard";

/**
 * Generischer Block-Listen-Body für WOD (defaultMode="amrap") und other
 * (defaultMode="straight"). Rendert alle Blöcke aus `draft.blocks` und
 * einen „+ Block hinzufügen"-Button. Kein WOD-Spezialschnickschnack —
 * der einzige Unterschied zwischen WOD und other ist der defaultMode.
 */
export function BlockListLogger({
  draft,
  defaultMode,
}: {
  draft: WorkoutDraft;
  defaultMode: WorkoutMode;
}) {
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
        {blocks.map((block, bi) => (
          <BlockCard
            key={block.key}
            block={block}
            index={bi}
            library={library}
            metricsFor={metricsFor}
            onPatch={(patch) => patchBlock(block.key, patch)}
            onRemove={() => removeBlock(block.key)}
            onPatchSet={(sKey, patch) => patchSet(block.key, sKey, patch)}
            onAddSet={() => addSet(block.key)}
            onRemoveSet={(sKey) => removeSet(block.key, sKey)}
            onExerciseCreated={onExerciseCreated}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => addBlock(defaultMode)}
        className="mt-4 h-11 w-full rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
      >
        + Block hinzufügen
      </button>
    </div>
  );
}
