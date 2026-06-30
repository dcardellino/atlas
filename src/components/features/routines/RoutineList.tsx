"use client";

import { useState, useTransition } from "react";
import {
  create,
  update,
  archive,
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
import type { AreaOption } from "@/components/features/tasks/TaskEditor";

/**
 * Routines UI (TASK-032, FR-007 / Vision Flow 3). Grouped by time of day with a
 * one-tap check-off that writes today's log and updates the visible streak, plus
 * a separate archive section. Sober streak feedback (no gamification).
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
        className={`mt-[2px] h-[18px] w-[18px] shrink-0 rounded-sm border border-border ${
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
  const [pending, startTransition] = useTransition();

  function save() {
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
    });
  }

  function doArchive() {
    if (!routine) return;
    startTransition(async () => {
      await archive(routine.id);
      onClose();
    });
  }

  return (
    <div
      className="bg-on-surface/30 fixed inset-0 z-40 flex items-start justify-center px-4 pt-16"
      onClick={onClose}
    >
      <div
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
            className={fieldInput}
          />
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
            <span className={fieldLabel}>Dauer (Tage)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="∞"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className={fieldInput}
            />
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
              onClick={doArchive}
              disabled={pending}
              className="h-11 rounded-sm px-2 font-mono text-label uppercase tracking-label text-on-surface-muted disabled:opacity-60"
            >
              Archivieren
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
  );
}

export default function RoutineList({
  routines,
  archived,
  areas,
}: {
  routines: RoutineState[];
  archived: Routine[];
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
        <p className="mt-8 text-body text-on-surface-muted">
          Noch keine Routinen. Lege deine erste Gewohnheit an.
        </p>
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

      {archived.length > 0 && (
        <div className="mt-12">
          <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Archiv
          </p>
          <ul className="mt-2">
            {archived.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 border-b border-border py-3"
              >
                <span className="flex-1 truncate text-body text-on-surface-muted line-through">
                  {r.name}
                </span>
                <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
                  {GROUP_LABEL[r.time_of_day]}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
