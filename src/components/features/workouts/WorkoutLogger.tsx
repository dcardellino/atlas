"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWorkout,
  updateWorkout,
  removeWorkout,
  createExercise,
  createTemplate,
} from "@/lib/workouts/actions";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  WORKOUT_MODES,
  WORKOUT_MODE_LABEL,
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABEL,
  SET_METRICS,
  type Exercise,
  type SetMetric,
  type WorkoutDetail,
  type WorkoutMode,
  type WorkoutType,
  type WorkoutInput,
} from "@/lib/workouts/types";
import {
  toInt,
  todayIso,
  emptySet,
  emptyBlock,
  detailToBlocks,
  blocksToInput,
  blocksToStructure,
  type SetDraft,
  type BlockDraft,
} from "@/lib/workouts/draft";
import { WorkoutFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Workout-Logger (Anlegen + Bearbeiten). Nachträgliches Protokollieren: Kopf
 * (Typ/Datum/Aufwand/Notiz), dann Blöcke, jeder mit einem Modus (EMOM/AMRAP/
 * Tabata/For Time/Sätze) und seinen Sätzen. Speichert verschachtelt über die
 * Server Action; kein Live-Timer.
 */

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";
const numInput =
  "w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-body-sm text-on-surface outline-none focus:border-accent";

export default function WorkoutLogger({
  exercises,
  workout,
}: {
  exercises: Exercise[];
  workout?: WorkoutDetail;
}) {
  const router = useRouter();
  const { show: showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
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

  function metricsFor(set: SetDraft): SetMetric[] {
    const ex = set.exercise_id ? exerciseById.get(set.exercise_id) : undefined;
    return ex?.metrics ?? ["reps", "weight"];
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

  function buildStructure() {
    // Wie buildInput, aber ohne Ergebnisse (result_*) — die Vorlage ist ein Plan.
    return blocksToStructure(blocks);
  }

  function saveTemplate() {
    const name = templateName.trim();
    if (name === "") return;
    startTransition(async () => {
      await createTemplate({ name, type, structure: buildStructure() });
      setSavingTemplate(false);
      setTemplateName("");
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

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={fieldLabel}>Training</p>
          <h1 className="mt-1 font-serif text-display text-on-surface">
            {workout ? "Workout bearbeiten" : "Neues Workout"}
          </h1>
        </div>
      </div>

      {/* Kopf */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="block">
          <span className={fieldLabel}>Typ</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkoutType)}
            className={fieldInput}
          >
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORKOUT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={fieldLabel}>Datum</span>
          <input
            type="date"
            value={performedOn}
            onChange={(e) => setPerformedOn(e.target.value)}
            aria-invalid={Boolean(errors?.performed_on)}
            className={fieldInput}
          />
          {errors?.performed_on && (
            <span className="mt-1 block text-body-sm text-danger">
              {errors.performed_on}
            </span>
          )}
        </label>
      </div>

      <label className="mt-3 block">
        <span className={fieldLabel}>Titel (optional)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Push Day, Hyrox-Simulation"
          className={fieldInput}
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className={fieldLabel}>Aufwand (RPE 1–10)</span>
          <input
            inputMode="numeric"
            value={effort}
            onChange={(e) => setEffort(e.target.value)}
            aria-invalid={Boolean(errors?.perceived_effort)}
            className={fieldInput}
          />
          {errors?.perceived_effort && (
            <span className="mt-1 block text-body-sm text-danger">
              {errors.perceived_effort}
            </span>
          )}
        </label>
      </div>

      <label className="mt-3 block">
        <span className={fieldLabel}>Notiz (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={fieldInput}
        />
      </label>

      {/* Blöcke */}
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
            onExerciseCreated={(ex) => setLibrary((l) => [...l, ex])}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addBlock}
        className="mt-4 h-11 w-full rounded-sm border border-border bg-surface-raised px-4 font-mono text-label uppercase tracking-label text-on-surface transition-colors hover:border-accent hover:text-accent"
      >
        + Block hinzufügen
      </button>

      {/* Aktionen */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
        >
          {workout ? "Speichern" : "Anlegen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => router.back()}
          className="h-11 rounded-sm px-4 font-mono text-label uppercase tracking-label text-on-surface-muted transition-colors hover:text-on-surface"
        >
          Abbrechen
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setSavingTemplate(true)}
          className="ml-auto h-11 rounded-sm px-3 font-mono text-label uppercase tracking-label text-on-surface-muted transition-colors hover:text-accent"
        >
          Als Vorlage
        </button>
        {workout && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="h-11 rounded-sm px-4 font-mono text-label uppercase tracking-label text-danger transition-colors hover:underline"
          >
            Löschen
          </button>
        )}
      </div>

      {savingTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-on-surface/30 px-4 pt-24"
          onClick={() => setSavingTemplate(false)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-border bg-surface-raised p-md"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={fieldLabel}>Als Vorlage speichern</p>
            <input
              autoFocus
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Name der Vorlage"
              className={fieldInput}
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSavingTemplate(false)}
                className="h-11 rounded-sm bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={pending || templateName.trim() === ""}
                onClick={saveTemplate}
                className="h-11 rounded-sm bg-on-surface px-4 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title="Workout löschen?"
          message="Das Workout und alle Sätze werden entfernt."
          confirmLabel="Löschen"
          onConfirm={() => {
            setConfirming(false);
            doDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </section>
  );
}

// --- Block-Karte -------------------------------------------------------------

function BlockCard({
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

// --- Modus-Konfiguration -----------------------------------------------------

function ModeConfig({
  block,
  onPatch,
}: {
  block: BlockDraft;
  onPatch: (patch: Partial<BlockDraft>) => void;
}) {
  const cfg =
    "w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-body-sm text-on-surface outline-none focus:border-accent";
  const lbl = "font-mono text-meta uppercase tracking-label text-on-surface-muted";

  if (block.mode === "straight") return null;

  return (
    <div className="mt-3 rounded-sm bg-surface p-2">
      {block.mode === "emom" && (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={lbl}>Intervall (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "amrap" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Cap (Sek.)</span>
            <input inputMode="numeric" value={block.duration_seconds} onChange={(e) => onPatch({ duration_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.result_rounds} onChange={(e) => onPatch({ result_rounds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>+ Wdh.</span>
            <input inputMode="numeric" value={block.result_reps} onChange={(e) => onPatch({ result_reps: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "tabata" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Work (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Rest (Sek.)</span>
            <input inputMode="numeric" value={block.rest_seconds} onChange={(e) => onPatch({ rest_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "for_time" && (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={lbl}>Cap (Sek., opt.)</span>
            <input inputMode="numeric" value={block.duration_seconds} onChange={(e) => onPatch({ duration_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Zeit (mm:ss)</span>
            <input value={block.result_seconds} onChange={(e) => onPatch({ result_seconds: e.target.value })} placeholder="z. B. 12:30" className={cfg} />
          </label>
        </div>
      )}

      {block.mode === "interval" && (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <span className={lbl}>Work (Sek.)</span>
            <input inputMode="numeric" value={block.interval_seconds} onChange={(e) => onPatch({ interval_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Rest (Sek.)</span>
            <input inputMode="numeric" value={block.rest_seconds} onChange={(e) => onPatch({ rest_seconds: e.target.value })} className={cfg} />
          </label>
          <label>
            <span className={lbl}>Runden</span>
            <input inputMode="numeric" value={block.rounds} onChange={(e) => onPatch({ rounds: e.target.value })} className={cfg} />
          </label>
        </div>
      )}
    </div>
  );
}

// --- Satz-Zeile mit Übungswahl ----------------------------------------------

function SetRow({
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

function ExercisePicker({
  set,
  library,
  onPatch,
  onExerciseCreated,
}: {
  set: SetDraft;
  library: Exercise[];
  onPatch: (patch: Partial<SetDraft>) => void;
  onExerciseCreated: (ex: Exercise) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<Exercise["category"]>("strength");
  const [newMetrics, setNewMetrics] = useState<SetMetric[]>(["reps", "weight"]);
  const [saving, setSaving] = useState(false);

  function onSelect(value: string) {
    if (value === "__new__") {
      setAdding(true);
      return;
    }
    if (value === "") {
      onPatch({ exercise_id: null, exercise_name: "" });
      return;
    }
    const ex = library.find((e) => e.id === value);
    onPatch({ exercise_id: value, exercise_name: ex?.name ?? "" });
  }

  async function createNew() {
    if (newName.trim() === "") return;
    setSaving(true);
    try {
      const ex = await createExercise({
        name: newName.trim(),
        category: newCat,
        metrics: newMetrics.length ? newMetrics : ["reps"],
      });
      onExerciseCreated(ex);
      onPatch({ exercise_id: ex.id, exercise_name: ex.name });
      setAdding(false);
      setNewName("");
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <div className="flex-1 rounded-sm border border-accent bg-surface-raised p-2">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Neue Übung"
          className="w-full rounded-sm border border-border bg-surface px-2 py-1 text-body-sm text-on-surface outline-none focus:border-accent"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={newCat}
            onChange={(e) => setNewCat(e.target.value as Exercise["category"])}
            className="rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta uppercase tracking-label text-on-surface outline-none focus:border-accent"
          >
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXERCISE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          {SET_METRICS.map((m) => (
            <label key={m} className="flex items-center gap-1 font-mono text-meta uppercase tracking-label text-on-surface-muted">
              <input
                type="checkbox"
                checked={newMetrics.includes(m)}
                onChange={(e) =>
                  setNewMetrics((ms) =>
                    e.target.checked ? [...ms, m] : ms.filter((x) => x !== m),
                  )
                }
              />
              {m}
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={createNew}
            className="rounded-sm bg-on-surface px-3 py-1 font-mono text-meta uppercase tracking-label text-surface hover:bg-accent hover:text-on-accent disabled:opacity-50"
          >
            Anlegen
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 py-1 font-mono text-meta uppercase tracking-label text-on-surface-muted hover:text-on-surface"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <select
      value={set.exercise_id ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      className="min-w-0 flex-1 rounded-sm border border-border bg-surface px-2 py-1.5 text-body-sm text-on-surface outline-none focus:border-accent"
      aria-label="Übung"
    >
      <option value="">Übung wählen…</option>
      {library.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
      <option value="__new__">+ Neue Übung…</option>
    </select>
  );
}
