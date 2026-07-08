"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  WORKOUT_TYPES,
  WORKOUT_TYPE_LABEL,
  type Exercise,
  type WorkoutDetail,
  type WorkoutType,
} from "@/lib/workouts/types";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useWorkoutDraft } from "./useWorkoutDraft";
import { fieldLabel, fieldInput } from "./fieldStyles";
import { WorkoutBody } from "./loggers/WorkoutBody";

/**
 * Workout-Logger (Anlegen + Bearbeiten). Rendert Kopf (Typ/Datum/Aufwand/Notiz),
 * dann den typspezifischen Body (WorkoutBody), Aktionsleiste und Modals.
 * Der Typwechsel-Flow fragt bei dirty Draft nach Bestätigung (Reset-Rückfrage).
 */

export default function WorkoutLogger({
  exercises,
  workout,
}: {
  exercises: Exercise[];
  workout?: WorkoutDetail;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  // Typwechsel-Flow: hält den angefragten neuen Typ bis zur Nutzerbestätigung
  const [pendingType, setPendingType] = useState<WorkoutType | null>(null);

  const draft = useWorkoutDraft({ exercises, workout });

  /**
   * Startet den Typwechsel-Flow. Bei dirty Draft → Rückfrage (ConfirmDialog);
   * bei sauberem Draft → sofortiges resetForType. Kein-op bei gleichem Typ.
   */
  function requestTypeChange(next: WorkoutType) {
    if (next === draft.type) return;
    if (draft.isDirty) {
      setPendingType(next);
    } else {
      draft.resetForType(next);
    }
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
            value={draft.type}
            onChange={(e) => requestTypeChange(e.target.value as WorkoutType)}
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
            value={draft.performedOn}
            onChange={(e) => draft.setPerformedOn(e.target.value)}
            aria-invalid={Boolean(draft.errors?.performed_on)}
            className={`${fieldInput} min-h-[42px] appearance-none text-left`}
          />
          {draft.errors?.performed_on && (
            <span className="mt-1 block text-body-sm text-danger">
              {draft.errors.performed_on}
            </span>
          )}
        </label>
      </div>

      <label className="mt-3 block">
        <span className={fieldLabel}>Titel (optional)</span>
        <input
          value={draft.title}
          onChange={(e) => draft.setTitle(e.target.value)}
          placeholder="z. B. Push Day, Hyrox-Simulation"
          className={fieldInput}
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className={fieldLabel}>Aufwand (RPE 1–10)</span>
          <input
            inputMode="numeric"
            value={draft.effort}
            onChange={(e) => draft.setEffort(e.target.value)}
            aria-invalid={Boolean(draft.errors?.perceived_effort)}
            className={fieldInput}
          />
          {draft.errors?.perceived_effort && (
            <span className="mt-1 block text-body-sm text-danger">
              {draft.errors.perceived_effort}
            </span>
          )}
        </label>
      </div>

      <label className="mt-3 block">
        <span className={fieldLabel}>Notiz (optional)</span>
        <textarea
          value={draft.notes}
          onChange={(e) => draft.setNotes(e.target.value)}
          rows={2}
          className={fieldInput}
        />
      </label>

      {/* Typspezifischer Body — kein zusätzlicher mt-Container, Bodies bringen mt-8 mit */}
      <WorkoutBody draft={draft} />

      {/* Aktionen */}
      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          disabled={draft.pending}
          onClick={draft.save}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
        >
          {workout ? "Speichern" : "Anlegen"}
        </button>
        <button
          type="button"
          disabled={draft.pending}
          onClick={() => router.back()}
          className="h-11 rounded-sm px-4 font-mono text-label uppercase tracking-label text-on-surface-muted transition-colors hover:text-on-surface"
        >
          Abbrechen
        </button>
        <button
          type="button"
          disabled={draft.pending}
          onClick={() => setSavingTemplate(true)}
          className="ml-auto h-11 rounded-sm px-3 font-mono text-label uppercase tracking-label text-on-surface-muted transition-colors hover:text-accent"
        >
          Als Vorlage
        </button>
        {workout && (
          <button
            type="button"
            disabled={draft.pending}
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
                disabled={draft.pending || templateName.trim() === ""}
                onClick={() =>
                  draft.saveTemplate(templateName.trim(), () => {
                    setSavingTemplate(false);
                    setTemplateName("");
                  })
                }
                className="h-11 rounded-sm bg-on-surface px-4 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen-Rückfrage */}
      {confirming && (
        <ConfirmDialog
          title="Workout löschen?"
          message="Das Workout und alle Sätze werden entfernt."
          confirmLabel="Löschen"
          onConfirm={() => {
            setConfirming(false);
            draft.doDelete();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}

      {/* Typwechsel-Rückfrage: erscheint wenn isDirty und neuer Typ ausgewählt */}
      {pendingType && (
        <ConfirmDialog
          title="Typ wechseln?"
          message="Die aktuelle Erfassung wird zurückgesetzt."
          confirmLabel="Wechseln"
          onConfirm={() => {
            draft.resetForType(pendingType);
            setPendingType(null);
          }}
          onCancel={() => setPendingType(null)}
        />
      )}
    </section>
  );
}
