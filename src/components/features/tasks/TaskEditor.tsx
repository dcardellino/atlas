"use client";

import { useState, useTransition } from "react";
import { create, update, remove, type Task } from "@/lib/tasks/actions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
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
    });
  }

  function doDelete() {
    if (!task) return;
    startTransition(async () => {
      await remove(task.id);
      onClose();
    });
  }

  return (
    <>
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-on-surface/30 px-4 pt-16"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>{task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</p>

        <label className="mt-3 block">
          <span className={fieldLabel}>Titel</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldInput}
          />
        </label>

        <label className="mt-3 block">
          <span className={fieldLabel}>Notizen</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={`${fieldInput} resize-none`}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Fällig</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={`${fieldInput} min-h-[42px] appearance-none text-left`}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Reminder</span>
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className={`${fieldInput} min-h-[42px] appearance-none text-left`}
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

        <div className="mt-4 flex items-center justify-between gap-3">
          {task ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="h-11 rounded-sm px-2 font-mono text-label uppercase tracking-label text-danger disabled:opacity-60"
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
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
    </div>
      {confirming && task && (
        <ConfirmDialog
          title="Aufgabe löschen"
          message={`„${task.title}“ wird endgültig gelöscht.`}
          onConfirm={doDelete}
          onCancel={() => setConfirming(false)}
          pending={pending}
        />
      )}
    </>
  );
}
