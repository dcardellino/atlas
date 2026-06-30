"use client";

import { useTransition } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toggleComplete, setTop3, type Task } from "@/lib/tasks/actions";
import { logToday, unlogToday } from "@/lib/routines/actions";
import type { RoutineState } from "@/lib/routines/types";
import { StreakIndicator } from "@/components/features/routines/StreakChart";
import type { TodaySummary, RecentInboxItem } from "@/lib/today/summary";

/**
 * Today-View UI (TASK-021). Sections: Top-3, heute fällig, kürzlich erfasst.
 * States Empty / Populated / Error (Loading via the route's loading.tsx). Quick
 * capture opens from the app-wide FAB (QuickCapture). Tone per Vision § Voice.
 */

const TZ = "Europe/Berlin";

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
      {children}
    </p>
  );
}

function TaskRow({ task }: { task: Task }) {
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
      <span className="flex-1 text-body text-on-surface">{task.title}</span>
      {task.due_at && (
        <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
          {formatInTimeZone(new Date(task.due_at), TZ, "HH:mm")}
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

function RoutineRow({ state }: { state: RoutineState }) {
  const [pending, startTransition] = useTransition();
  const { routine, loggedToday, streak } = state;
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
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
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border border-border text-[11px] leading-none ${
          loggedToday ? "bg-on-surface text-surface" : "bg-surface"
        }`}
      >
        {loggedToday ? "✓" : ""}
      </button>
      <span
        className={`flex-1 text-body ${
          loggedToday ? "text-on-surface-muted" : "text-on-surface"
        }`}
      >
        {routine.name}
      </span>
      <StreakIndicator streak={streak} />
    </li>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-2">{children}</ul>
    </section>
  );
}

function RecentRow({ item }: { item: RecentInboxItem }) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="flex-1 truncate text-body-sm text-on-surface-muted">
        {item.raw_text}
      </span>
      <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
        {item.status === "failed" ? "inbox" : (item.classified_type ?? "")}
      </span>
    </li>
  );
}

export default function TodayView({
  data,
  error,
}: {
  data?: TodaySummary;
  error?: boolean;
}) {
  if (error || !data) {
    return (
      <section>
        <Eyebrow>Heute</Eyebrow>
        <h1 className="mt-1 font-serif text-display text-on-surface">Today</h1>
        <p role="alert" className="mt-6 text-body text-danger">
          Konnte den Tag nicht laden.{" "}
          <a href="/today" className="underline">
            Neu versuchen
          </a>
        </p>
      </section>
    );
  }

  const isEmpty =
    data.top3.length === 0 &&
    data.dueToday.length === 0 &&
    data.recentInbox.length === 0 &&
    data.routines.length === 0;

  return (
    <section>
      <Eyebrow>Heute</Eyebrow>
      <h1 className="mt-1 font-serif text-display text-on-surface">Today</h1>

      {isEmpty ? (
        <p className="mt-6 text-body text-on-surface-muted">
          Noch nichts für heute. Sprich oder tippe deinen ersten Gedanken.
        </p>
      ) : (
        <>
          {data.top3.length > 0 && (
            <Section title="Top 3">
              {data.top3.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          {data.dueToday.length > 0 && (
            <Section title="Heute fällig">
              {data.dueToday.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </Section>
          )}
          {data.routines.length > 0 && (
            <Section title="Routinen">
              {data.routines.map((r) => (
                <RoutineRow key={r.routine.id} state={r} />
              ))}
            </Section>
          )}
          {data.recentInbox.length > 0 && (
            <Section title="Kürzlich erfasst">
              {data.recentInbox.map((i) => (
                <RecentRow key={i.id} item={i} />
              ))}
            </Section>
          )}
        </>
      )}
    </section>
  );
}
