"use client";

import { useState, useTransition } from "react";
import {
  createExercise,
  updateExercise,
  archiveExercise,
} from "@/lib/workouts/actions";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABEL,
  SET_METRICS,
  SET_METRIC_LABEL,
  type Exercise,
  type ExerciseCategory,
  type SetMetric,
} from "@/lib/workouts/types";
import { ExerciseFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/**
 * Übungs-Bibliothek verwalten: die geseedeten Standards + eigene Übungen,
 * gruppiert nach Kategorie. Anlegen/Bearbeiten über ein Overlay, Entfernen
 * archiviert (Set-Historie bleibt via Snapshot erhalten).
 */

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";

function Editor({
  exercise,
  onClose,
}: {
  exercise: Exercise | null;
  onClose: () => void;
}) {
  const { show: showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(exercise?.name ?? "");
  const [category, setCategory] = useState<ExerciseCategory>(
    exercise?.category ?? "strength",
  );
  const [metrics, setMetrics] = useState<SetMetric[]>(
    exercise?.metrics ?? ["reps", "weight"],
  );
  const [errors, setErrors] = useState<Record<string, string> | null>(null);

  function save() {
    const errs = fieldErrors(ExerciseFormSchema, { name, category, metrics });
    setErrors(errs);
    if (errs) return;
    startTransition(async () => {
      if (exercise) {
        await updateExercise(exercise.id, { name: name.trim(), category, metrics });
      } else {
        await createExercise({ name: name.trim(), category, metrics });
      }
      onClose();
      showToast(exercise ? "Gespeichert" : "Übung angelegt");
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-on-surface/30 px-4 pt-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={exercise ? "Übung bearbeiten" : "Neue Übung"}
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>{exercise ? "Übung bearbeiten" : "Neue Übung"}</p>

        <label className="mt-3 block">
          <span className={fieldLabel}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors?.name)}
            className={fieldInput}
          />
          {errors?.name && (
            <span className="mt-1 block text-body-sm text-danger">{errors.name}</span>
          )}
        </label>

        <label className="mt-3 block">
          <span className={fieldLabel}>Kategorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExerciseCategory)}
            className={fieldInput}
          >
            {EXERCISE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXERCISE_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="mt-3">
          <legend className={fieldLabel}>Metriken</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {SET_METRICS.map((m) => (
              <label key={m} className="flex items-center gap-1 text-body-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={metrics.includes(m)}
                  onChange={(e) =>
                    setMetrics((ms) =>
                      e.target.checked ? [...ms, m] : ms.filter((x) => x !== m),
                    )
                  }
                />
                {SET_METRIC_LABEL[m]}
              </label>
            ))}
          </div>
          {errors?.metrics && (
            <span className="mt-1 block text-body-sm text-danger">{errors.metrics}</span>
          )}
        </fieldset>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
          >
            {exercise ? "Speichern" : "Anlegen"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-sm px-4 font-mono text-label uppercase tracking-label text-on-surface-muted transition-colors hover:text-on-surface"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExerciseLibrary({
  exercises,
}: {
  exercises: Exercise[];
}) {
  const { show: showToast } = useToast();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const byCategory = new Map<ExerciseCategory, Exercise[]>();
  for (const e of exercises) {
    const arr = byCategory.get(e.category) ?? [];
    arr.push(e);
    byCategory.set(e.category, arr);
  }

  function doArchive(id: string) {
    startTransition(async () => {
      await archiveExercise(id);
      showToast("Übung archiviert");
    });
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="h-11 rounded-sm bg-on-surface px-4 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
      >
        + Neue Übung
      </button>

      <div className="mt-6 space-y-6">
        {EXERCISE_CATEGORIES.map((cat) => {
          const items = byCategory.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat}>
              <p className={fieldLabel}>{EXERCISE_CATEGORY_LABEL[cat]}</p>
              <ul className="mt-2">
                {items.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2"
                  >
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="min-w-0 flex-1 truncate text-left text-body text-on-surface transition-colors hover:text-accent"
                    >
                      {e.name}
                      <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
                        {e.metrics.map((m) => SET_METRIC_LABEL[m]).join(" · ")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchivingId(e.id)}
                      aria-label={`${e.name} archivieren`}
                      className="shrink-0 font-mono text-meta uppercase tracking-label text-on-surface-muted transition-colors hover:text-danger"
                    >
                      Archivieren
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {(creating || editing) && (
        <Editor
          exercise={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {archivingId && (
        <ConfirmDialog
          title="Übung archivieren?"
          message="Die Übung verschwindet aus der Auswahl. Deine bisherige Historie bleibt erhalten."
          confirmLabel="Archivieren"
          onConfirm={() => {
            doArchive(archivingId);
            setArchivingId(null);
          }}
          onCancel={() => setArchivingId(null)}
        />
      )}
    </div>
  );
}
