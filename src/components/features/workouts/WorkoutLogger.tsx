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
import { BlockCard } from "./BlockCard";

/**
 * Workout-Logger (Anlegen + Bearbeiten). Nachträgliches Protokollieren: Kopf
 * (Typ/Datum/Aufwand/Notiz), dann Blöcke, jeder mit einem Modus (EMOM/AMRAP/
 * Tabata/For Time/Sätze) und seinen Sätzen. Speichert verschachtelt über die
 * Server Action; kein Live-Timer.
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

  const {
    library,
    type,
    performedOn,
    title,
    effort,
    notes,
    blocks,
    errors,
    pending,
    setType,
    setPerformedOn,
    setTitle,
    setEffort,
    setNotes,
    patchBlock,
    patchSet,
    addBlock,
    removeBlock,
    addSet,
    removeSet,
    metricsFor,
    onExerciseCreated,
    save,
    saveTemplate,
    doDelete,
  } = useWorkoutDraft({ exercises, workout });

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
            onExerciseCreated={onExerciseCreated}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => addBlock()}
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
                onClick={() =>
                  saveTemplate(templateName.trim(), () => {
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

