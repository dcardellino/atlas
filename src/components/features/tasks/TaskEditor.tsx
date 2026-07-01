"use client";

import { useState, useTransition } from "react";
import { create, update, type Task } from "@/lib/tasks/actions";
import { useToast } from "@/components/ui/Toast";
import { TaskFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

/**
 * Task detail/edit form (TASK-023). Edits title, notes, due_at, reminder_at,
 * area and recurrence. With `task` set it persists via `update`; with `task`
 * null it creates a new task via `create` (manual, non-AI capture). Rendered as
 * an overlay by TaskList and TodayView.
 */

export type AreaOption = { id: string; name: string };

const RECURRENCES = [
  { value: "", label: "Keine" },
  { value: "daily", label: "Täglich" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "monthly", label: "Monatlich" },
];

// ISO instant → value for <input type="datetime-local"> (local wall time).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";

export default function TaskEditor({
  task,
  areas,
  onClose,
}: {
  task: Task | null;
  areas: AreaOption[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [dueAt, setDueAt] = useState(toLocalInput(task?.due_at ?? null));
  const [reminderAt, setReminderAt] = useState(
    toLocalInput(task?.reminder_at ?? null),
  );
  const [areaId, setAreaId] = useState(task?.area_id ?? "");
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "");
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const { show: showToast } = useToast();
  useEscapeKey(onClose);

  function save() {
    const errs = fieldErrors(TaskFormSchema, { title, notes, recurrence });
    setErrors(errs);
    if (errs) return;
    startTransition(async () => {
      const values = {
        title: title.trim(),
        notes: notes.trim() || null,
        due_at: fromLocalInput(dueAt),
        reminder_at: fromLocalInput(reminderAt),
        area_id: areaId || null,
        recurrence: recurrence || null,
      };
      if (task) {
        await update(task.id, values);
      } else {
        await create(values);
      }
      onClose();
      showToast(task ? "Gespeichert" : "Aufgabe angelegt");
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
        aria-label={task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>{task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</p>

        <label className="mt-3 block">
          <span className={fieldLabel}>Titel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(errors?.title)}
            className={fieldInput}
          />
          {errors?.title && (
            <span role="alert" className="mt-1 block text-body-sm text-danger">
              {errors.title}
            </span>
          )}
        </label>

        <label className="mt-3 block">
          <span className={fieldLabel}>Notizen</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            aria-invalid={Boolean(errors?.notes)}
            className={`${fieldInput} resize-none`}
          />
          {errors?.notes && (
            <span role="alert" className="mt-1 block text-body-sm text-danger">
              {errors.notes}
            </span>
          )}
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Fällig</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={fieldInput}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Reminder</span>
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className={fieldInput}
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Bereich</span>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className={fieldInput}
            >
              <option value="">Unzugeordnet</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Wiederholung</span>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className={fieldInput}
            >
              {RECURRENCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-sm bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !title.trim()}
            className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
          >
            {pending
              ? task
                ? "Speichern…"
                : "Anlegen…"
              : task
                ? "Speichern"
                : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}
