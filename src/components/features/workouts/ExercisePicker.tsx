"use client";

import { useState } from "react";
import { createExercise } from "@/lib/workouts/actions";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABEL,
  SET_METRICS,
  type Exercise,
  type SetMetric,
} from "@/lib/workouts/types";
import type { SetDraft } from "@/lib/workouts/draft";

/**
 * Übungs-Auswahl-Dropdown mit Inline-Formular zum Anlegen neuer Übungen.
 * Wechselt zwischen Auswahl-Modus und Anlege-Modus.
 */
export function ExercisePicker({
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
