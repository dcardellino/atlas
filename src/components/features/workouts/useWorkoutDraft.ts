"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkout,
  updateWorkout,
  removeWorkout,
  createTemplate,
} from "@/lib/workouts/actions";
import {
  type Exercise,
  type SetMetric,
  type TemplateBlock,
  type WorkoutDetail,
  type WorkoutInput,
  type WorkoutType,
} from "@/lib/workouts/types";
import {
  toInt,
  todayIso,
  emptyBlock,
  emptySet,
  detailToBlocks,
  blocksToInput,
  blocksToStructure,
  defaultBlocksForType,
  isDraftDirty,
  type SetDraft,
  type BlockDraft,
} from "@/lib/workouts/draft";
import { WorkoutFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useToast } from "@/components/ui/Toast";

/** Alle Draft-Daten, Mutatoren und Persistenz-Aktionen als einzelnes Objekt. */
export type WorkoutDraft = {
  // --- Zustand ---
  library: Exercise[];
  type: WorkoutType;
  performedOn: string;
  title: string;
  effort: string;
  notes: string;
  blocks: BlockDraft[];
  errors: Record<string, string> | null;
  pending: boolean;

  // --- Abgeleitet ---
  exerciseById: Map<string, Exercise>;
  isDirty: boolean;
  /** true wenn ein bestehendes Workout bearbeitet wird. */
  isEditing: boolean;

  // --- Kopf-Setter ---
  setType: (v: WorkoutType) => void;
  setPerformedOn: (v: string) => void;
  setTitle: (v: string) => void;
  setEffort: (v: string) => void;
  setNotes: (v: string) => void;

  // --- Bibliothek ---
  onExerciseCreated: (ex: Exercise) => void;

  // --- Block-/Set-Mutatoren ---
  patchBlock: (key: string, patch: Partial<BlockDraft>) => void;
  patchSet: (bKey: string, sKey: string, patch: Partial<SetDraft>) => void;
  addBlock: () => void;
  removeBlock: (key: string) => void;
  addSet: (bKey: string) => void;
  removeSet: (bKey: string, sKey: string) => void;

  /** Liefert die trackbaren Metriken für einen Satz, basierend auf der Übung. */
  metricsFor: (set: SetDraft) => SetMetric[];

  // --- Build-Helfer ---
  buildInput: () => WorkoutInput;
  buildStructure: () => TemplateBlock[];

  /**
   * Typ-Reset (Baustein für Task 9): setzt type = next und blocks =
   * defaultBlocksForType(next, library). In Task 3 noch nicht vom Shell
   * aufgerufen, aber bereit.
   */
  resetForType: (next: WorkoutType) => void;

  // --- Persistenz ---
  save: () => void;
  /**
   * Speichert die aktuelle Block-Struktur als Vorlage. `name` kommt als
   * Parameter, weil der Modal-Input-State in der Shell lebt. `onDone` wird
   * nach dem Speichern aufgerufen (z. B. Modal schließen + Eingabe löschen).
   */
  saveTemplate: (name: string, onDone?: () => void) => void;
  doDelete: () => void;
};

/**
 * Kapselt den gesamten Workout-Draft-State, alle Mutatoren und die
 * Persistenz-Aktionen. Gibt ein einziges `WorkoutDraft`-Objekt zurück,
 * das später als Prop an typspezifische Body-Komponenten weitergegeben wird.
 */
export function useWorkoutDraft({
  exercises,
  workout,
}: {
  exercises: Exercise[];
  workout?: WorkoutDetail;
}): WorkoutDraft {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  const [library, setLibrary] = useState<Exercise[]>(exercises);
  const [type, setType] = useState<WorkoutType>(workout?.type ?? "strength");
  const [performedOn, setPerformedOn] = useState(
    workout?.performed_on ?? todayIso(),
  );
  const [title, setTitle] = useState(workout?.title ?? "");
  const [effort, setEffort] = useState(
    workout?.perceived_effort?.toString() ?? "",
  );
  const [notes, setNotes] = useState(workout?.notes ?? "");
  const [blocks, setBlocks] = useState<BlockDraft[]>(
    workout ? detailToBlocks(workout) : [emptyBlock()],
  );

  const exerciseById = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const e of library) m.set(e.id, e);
    return m;
  }, [library]);

  const isDirty = isDraftDirty(blocks);
  const isEditing = Boolean(workout);

  function metricsFor(set: SetDraft): SetMetric[] {
    const ex = set.exercise_id ? exerciseById.get(set.exercise_id) : undefined;
    return ex?.metrics ?? ["reps", "weight"];
  }

  function onExerciseCreated(ex: Exercise) {
    setLibrary((l) => [...l, ex]);
  }

  // --- Block-/Set-Mutatoren --------------------------------------------------

  function patchBlock(key: string, patch: Partial<BlockDraft>) {
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }
  function patchSet(bKey: string, sKey: string, patch: Partial<SetDraft>) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === bKey
          ? {
              ...b,
              sets: b.sets.map((s) =>
                s.key === sKey ? { ...s, ...patch } : s,
              ),
            }
          : b,
      ),
    );
  }
  function addBlock() {
    setBlocks((bs) => [...bs, emptyBlock()]);
  }
  function removeBlock(key: string) {
    setBlocks((bs) => bs.filter((b) => b.key !== key));
  }
  function addSet(bKey: string) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === bKey ? { ...b, sets: [...b.sets, emptySet()] } : b,
      ),
    );
  }
  function removeSet(bKey: string, sKey: string) {
    setBlocks((bs) =>
      bs.map((b) =>
        b.key === bKey
          ? { ...b, sets: b.sets.filter((s) => s.key !== sKey) }
          : b,
      ),
    );
  }

  // --- Speichern -------------------------------------------------------------

  function buildInput(): WorkoutInput {
    return {
      title: title.trim() || null,
      type,
      performed_on: performedOn,
      notes: notes.trim() || null,
      perceived_effort: toInt(effort),
      total_duration_seconds: null,
      blocks: blocksToInput(blocks),
    };
  }

  function buildStructure(): TemplateBlock[] {
    // Wie buildInput, aber ohne Ergebnisse (result_*) — die Vorlage ist ein Plan.
    return blocksToStructure(blocks);
  }

  function resetForType(next: WorkoutType) {
    setType(next);
    setBlocks(defaultBlocksForType(next, library));
  }

  function save() {
    const errs = fieldErrors(WorkoutFormSchema, {
      title,
      type,
      performed_on: performedOn,
      notes,
      perceived_effort: effort,
    });
    setErrors(errs);
    if (errs) return;
    const input = buildInput();
    startTransition(async () => {
      if (workout) {
        await updateWorkout(workout.id, input);
        showToast("Workout gespeichert");
        router.push(`/workouts/${workout.id}`);
      } else {
        const created = await createWorkout(input);
        showToast("Workout angelegt");
        router.push(`/workouts/${created.id}`);
      }
    });
  }

  function saveTemplate(name: string, onDone?: () => void) {
    if (name === "") return;
    startTransition(async () => {
      await createTemplate({ name, type, structure: buildStructure() });
      onDone?.();
      showToast("Als Vorlage gespeichert");
    });
  }

  function doDelete() {
    if (!workout) return;
    startTransition(async () => {
      await removeWorkout(workout.id);
      showToast("Workout gelöscht");
      router.push("/workouts");
    });
  }

  return {
    library,
    type,
    performedOn,
    title,
    effort,
    notes,
    blocks,
    errors,
    pending,
    exerciseById,
    isDirty,
    isEditing,
    setType,
    setPerformedOn,
    setTitle,
    setEffort,
    setNotes,
    onExerciseCreated,
    patchBlock,
    patchSet,
    addBlock,
    removeBlock,
    addSet,
    removeSet,
    metricsFor,
    buildInput,
    buildStructure,
    resetForType,
    save,
    saveTemplate,
    doDelete,
  };
}
