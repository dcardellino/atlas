"use client";

import { useState, useTransition } from "react";
import {
  create,
  update,
  remove,
  logToday,
  unlogToday,
} from "@/lib/routines/actions";
import {
  TIMES_OF_DAY,
  type Routine,
  type RoutineState,
  type TimeOfDay,
} from "@/lib/routines/types";
import StreakChart from "@/components/features/routines/StreakChart";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { AreaOption } from "@/components/features/tasks/TaskEditor";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { RoutineFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

/**
 * Routines UI (TASK-032, FR-007 / Vision Flow 3). Grouped by time of day with a
 * one-tap check-off that writes today's log and updates the visible streak.
 * Sober streak feedback (no gamification).
 */

const GROUP_LABEL: Record<TimeOfDay, string> = {
  morning: "Morgens",
  afternoon: "Mittags",
  evening: "Abends",
  anytime: "Jederzeit",
};

function RoutineRow({
  state,
  areaName,
  onEdit,
}: {
  state: RoutineState;
  areaName: string | null;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { routine, loggedToday, streak, last30 } = state;

  return (
    <li className="flex items-start gap-3 border-b border-border py-3">
      <button
        type="button"
        aria-label={loggedToday ? "Abhaken rückgängig" : "Heute abhaken"}
        aria-pressed={loggedToday}
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            loggedToday ? unlogToday(routine.id) : logToday(routine.id),
          )
        }
        className={`mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-border text-[11px] leading-none ${
          loggedToday ? "bg-on-surface text-surface" : "bg-surface"
        }`}
      >
        {loggedToday ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="truncate text-body text-on-surface">
            {routine.name}
          </span>
          {areaName && (
            <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
              {areaName}
            </span>
          )}
          {routine.specific_time && (
            <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
              {routine.specific_time.slice(0, 5)}
            </span>
          )}
        </button>
        <div className="mt-2">
          <StreakChart days={last30} streak={streak} />
        </div>
      </div>
    </li>
  );
}

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";

function RoutineEditor({
  routine,
  areas,
  onClose,
}: {
  routine: Routine | null; // null → create
  areas: AreaOption[];
  onClose: () => void;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(
    routine?.time_of_day ?? "anytime",
  );
  const [specificTime, setSpecificTime] = useState(
    routine?.specific_time?.slice(0, 5) ?? "",
  );
  const [durationDays, setDurationDays] = useState(
    routine?.duration_days != null ? String(routine.duration_days) : "",
  );
  const [notify, setNotify] = useState(routine?.notify ?? false);
  const [areaId, setAreaId] = useState(routine?.area_id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const { show: showToast } = useToast();
  useEscapeKey(onClose);

  function save() {
    const errs = fieldErrors(RoutineFormSchema, {
      name,
      description,
      time_of_day: timeOfDay,
      specific_time: specificTime,
      duration_days: durationDays,
    });
    setErrors(errs);
    if (errs) return;
    const patch = {
      name: name.trim(),
      description: description.trim() || null,
      time_of_day: timeOfDay,
      specific_time: specificTime || null,
      duration_days: durationDays ? Number(durationDays) : null,
      notify,
      area_id: areaId || null,
    };
    startTransition(async () => {
      if (routine) await update(routine.id, patch);
      else await create(patch);
      onClose();
      showToast(routine ? "Gespeichert" : "Routine angelegt");
    });
  }

  function doDelete() {
    if (!routine) return;
    startTransition(async () => {
      await remove(routine.id);
      onClose();
      showToast("Routine gelöscht");
    });
  }

  return (
    <>
    <div
      className="bg-on-surface/30 fixed inset-0 z-40 flex items-start justify-center px-4 pt-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={routine ? "Routine bearbeiten" : "Neue Routine"}
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>
          {routine ? "Routine bearbeiten" : "Neue Routine"}
        </p>

        <label className="mt-3 block">
          <span className={fieldLabel}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={Boolean(errors?.name)}
            className={fieldInput}
          />
          {errors?.name && (
            <span role="alert" className="mt-1 block text-body-sm text-danger">
              {errors.name}
            </span>
          )}
        </label>

        <label className="mt-3 block">
          <span className={fieldLabel}>Beschreibung</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${fieldInput} resize-none`}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className={fieldLabel}>Tageszeit</span>
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as TimeOfDay)}
              className={fieldInput}
            >
              {TIMES_OF_DAY.map((t) => (
                <option key={t} value={t}>
                  {GROUP_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Uhrzeit</span>
            <input
              type="time"
              value={specificTime}
              onChange={(e) => setSpecificTime(e.target.value)}
              aria-invalid={Boolean(errors?.specific_time)}
              className={`${fieldInput} min-h-[42px] appearance-none text-left`}
            />
            {errors?.specific_time && (
              <span role="alert" className="mt-1 block text-body-sm text-danger">
                {errors.specific_time}
              </span>
            )}
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
            <span className={fieldLabel}>Dauer (Tage)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="∞"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              aria-invalid={Boolean(errors?.duration_days)}
              className={fieldInput}
            />
            {errors?.duration_days && (
              <span role="alert" className="mt-1 block text-body-sm text-danger">
                {errors.duration_days}
              </span>
            )}
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="h-[18px] w-[18px] rounded-sm border border-border"
          />
          <span className={fieldLabel}>Erinnerung senden</span>
        </label>

        <div className="mt-6 flex items-center justify-between gap-3">
          {routine ? (
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
              disabled={pending || !name.trim()}
              className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
            >
              {pending ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
      {confirming && routine && (
        <ConfirmDialog
          title="Routine löschen"
          message={`„${routine.name}“ und die zugehörige Streak-Historie werden endgültig gelöscht.`}
          onConfirm={doDelete}
          onCancel={() => setConfirming(false)}
          pending={pending}
        />
      )}
    </>
  );
}

export default function RoutineList({
  routines,
  areas,
}: {
  routines: RoutineState[];
  areas: AreaOption[];
}) {
  const [editing, setEditing] = useState<Routine | null>(null);
  const [creating, setCreating] = useState(false);

  const areaName = new Map(areas.map((a) => [a.id, a.name]));

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Routinen
          </p>
          <h1 className="mt-1 font-serif text-display text-on-surface">
            Routines
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-11 rounded-sm bg-on-surface px-4 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
        >
          Neu
        </button>
      </div>

      {routines.length === 0 ? (
        <EmptyState
          title="Noch keine Routinen."
          hint="Lege deine erste Gewohnheit an."
        />
      ) : (
        TIMES_OF_DAY.map((tod) => {
          const group = routines.filter((r) => r.routine.time_of_day === tod);
          if (group.length === 0) return null;
          return (
            <div key={tod} className="mt-8">
              <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
                {GROUP_LABEL[tod]}
              </p>
              <ul className="mt-2">
                {group.map((state) => (
                  <RoutineRow
                    key={state.routine.id}
                    state={state}
                    areaName={
                      state.routine.area_id
                        ? (areaName.get(state.routine.area_id) ?? null)
                        : null
                    }
                    onEdit={() => setEditing(state.routine)}
                  />
                ))}
              </ul>
            </div>
          );
        })
      )}

      {(editing || creating) && (
        <RoutineEditor
          routine={editing}
          areas={areas}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}
