"use client";

import { useMemo, useState, useTransition } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toggleComplete, setTop3, type Task } from "@/lib/tasks/actions";
import TaskEditor, {
  type AreaOption,
} from "@/components/features/tasks/TaskEditor";

/**
 * Tasks list UI (TASK-022). Filter by status (open/done/all) and area, sorted by
 * due date, check to complete, Top-3 star, and edit. Filtering is client-side
 * over the full set (single-user, small data); mutations go through the server
 * actions, which revalidate the route.
 */

const TZ = "Europe/Berlin";
type StatusFilter = "open" | "done" | "all";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm px-3 py-1 font-mono text-meta uppercase tracking-label ${
        active
          ? "bg-on-surface text-surface"
          : "bg-surface text-on-surface-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  task,
  areaName,
  onEdit,
}: {
  task: Task;
  areaName: string | null;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <button
        type="button"
        aria-label={task.status === "done" ? "Wieder öffnen" : "Abhaken"}
        disabled={pending}
        onClick={() => startTransition(() => toggleComplete(task.id))}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-border text-[11px] leading-none ${
          task.status === "done" ? "bg-on-surface text-surface" : "bg-surface"
        }`}
      >
        {task.status === "done" ? "✓" : ""}
      </button>
      <button type="button" onClick={onEdit} className="flex-1 text-left">
        <span
          className={`text-body ${
            task.status === "done"
              ? "text-on-surface-muted line-through"
              : "text-on-surface"
          }`}
        >
          {task.title}
        </span>
        {areaName && (
          <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {areaName}
          </span>
        )}
      </button>
      {task.due_at && (
        <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
          {formatInTimeZone(new Date(task.due_at), TZ, "dd.MM HH:mm")}
        </span>
      )}
      <button
        type="button"
        aria-label="Top-3"
        aria-pressed={task.is_top3}
        disabled={pending}
        onClick={() => startTransition(() => setTop3(task.id, !task.is_top3))}
        className={task.is_top3 ? "text-accent" : "text-on-surface-muted"}
      >
        ★
      </button>
    </li>
  );
}

export default function TaskList({
  tasks,
  areas,
}: {
  tasks: Task[];
  areas: AreaOption[];
}) {
  const [status, setStatus] = useState<StatusFilter>("open");
  const [areaId, setAreaId] = useState<string>("all");
  const [editing, setEditing] = useState<Task | null>(null);

  const areaName = useMemo(
    () => new Map(areas.map((a) => [a.id, a.name])),
    [areas],
  );

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (areaId !== "all" && t.area_id !== areaId) return false;
        return true;
      }),
    [tasks, status, areaId],
  );

  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Aufgaben
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Tasks</h1>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Chip active={status === "open"} onClick={() => setStatus("open")}>
          Open
        </Chip>
        <Chip active={status === "done"} onClick={() => setStatus("done")}>
          Done
        </Chip>
        <Chip active={status === "all"} onClick={() => setStatus("all")}>
          All
        </Chip>
        <span className="mx-1 text-on-surface-muted">·</span>
        <Chip active={areaId === "all"} onClick={() => setAreaId("all")}>
          Alle Bereiche
        </Chip>
        {areas.map((a) => (
          <Chip
            key={a.id}
            active={areaId === a.id}
            onClick={() => setAreaId(a.id)}
          >
            {a.name}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-body text-on-surface-muted">
          Keine Aufgaben hier. Erfasse deinen ersten Gedanken.
        </p>
      ) : (
        <ul className="mt-4">
          {visible.map((t) => (
            <Row
              key={t.id}
              task={t}
              areaName={t.area_id ? (areaName.get(t.area_id) ?? null) : null}
              onEdit={() => setEditing(t)}
            />
          ))}
        </ul>
      )}

      {editing && (
        <TaskEditor
          task={editing}
          areas={areas}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
