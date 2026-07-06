"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Task } from "@/lib/tasks/actions";
import { create } from "@/lib/journal/actions";
import {
  composeEveningBody,
  computeTasksDone,
  type EveningAnswers,
} from "@/lib/journal/checkins";
import { useToast } from "@/components/ui/Toast";

/**
 * Evening Close. The "3 tasks done?" field is pre-computed from the current
 * Top-3 task statuses but remains user-overridable before save.
 */

const FIELD_LABEL =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

export default function EveningJournalForm({ top3Tasks }: { top3Tasks: Task[] }) {
  const router = useRouter();
  const [tasksDone, setTasksDone] = useState(computeTasksDone(top3Tasks));
  const [movedToday, setMovedToday] = useState("");
  const [carriesToTomorrow, setCarriesToTomorrow] = useState("");
  const [remembering, setRemembering] = useState("");
  const [tomorrowFirstTask, setTomorrowFirstTask] = useState("");
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function save() {
    if (
      pending ||
      !movedToday.trim() ||
      !carriesToTomorrow.trim() ||
      !remembering.trim() ||
      !tomorrowFirstTask.trim()
    ) {
      return;
    }

    startTransition(async () => {
      const answers: EveningAnswers = {
        tasksDone,
        movedToday,
        carriesToTomorrow,
        remembering,
        tomorrowFirstTask,
      };

      await create({
        body: composeEveningBody(answers),
        source: "pwa_evening",
      });

      showToast("Evening Close gespeichert");
      router.push("/journal");
    });
  }

  return (
    <section>
      <p className={FIELD_LABEL}>The Evening Close</p>
      <h1 className="mt-1 font-serif text-display text-on-surface">
        Evening Close
      </h1>

      <div className="mt-6 space-y-6">
        <div>
          <span className={`block ${FIELD_LABEL}`}>3 Aufgaben geschafft?</span>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="checkbox"
              checked={tasksDone}
              onChange={(e) => setTasksDone(e.target.checked)}
            />
            <span className="text-body text-on-surface">
              {tasksDone ? "Ja" : "Nein"}
            </span>
          </div>
          {top3Tasks.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-sm bg-surface px-3 py-2">
              {top3Tasks.map((t) => (
                <li key={t.id} className="text-body-sm text-on-surface-muted">
                  {t.status === "done" ? "✓" : "○"} {t.title}
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Was hat sich heute bewegt?
          </span>
          <textarea
            value={movedToday}
            onChange={(e) => setMovedToday(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            rows={3}
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Was geht auf morgen über?
          </span>
          <textarea
            value={carriesToTomorrow}
            onChange={(e) => setCarriesToTomorrow(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            rows={3}
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Eine Sache, die es wert ist, sich zu merken
          </span>
          <textarea
            value={remembering}
            onChange={(e) => setRemembering(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            rows={3}
          />
        </label>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Erste Aufgabe morgen
          </span>
          <input
            type="text"
            value={tomorrowFirstTask}
            onChange={(e) => setTomorrowFirstTask(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={
            pending ||
            !movedToday.trim() ||
            !carriesToTomorrow.trim() ||
            !remembering.trim() ||
            !tomorrowFirstTask.trim()
          }
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}
