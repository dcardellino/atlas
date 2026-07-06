"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTop3, type Task } from "@/lib/tasks/actions";
import { create } from "@/lib/journal/actions";
import { composeMorningBody } from "@/lib/journal/checkins";
import { useToast } from "@/components/ui/Toast";

/**
 * Morning Setup (TASK-<next>). Top 3 is not free text — it reuses the app's
 * existing is_top3 flag on tasks (setTop3), so this form is the same source of
 * truth as the Tasks screen and Today view, not a parallel list.
 */

const MAX_TOP3 = 3;
const FIELD_LABEL =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

export default function MorningJournalForm({
  openTasks,
}: {
  openTasks: Task[];
}) {
  const router = useRouter();
  const [feeling, setFeeling] = useState("");
  const [selected, setSelected] = useState<string[]>(
    openTasks.filter((t) => t.is_top3).map((t) => t.id),
  );
  const [avoiding, setAvoiding] = useState("");
  const [gratitude, setGratitude] = useState(["", "", ""]);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function toggleTask(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_TOP3) return prev;
      return [...prev, id];
    });
  }

  function save() {
    if (pending || !feeling.trim() || !avoiding.trim()) return;
    startTransition(async () => {
      await Promise.all(
        openTasks
          .filter((t) => selected.includes(t.id) !== t.is_top3)
          .map((t) => setTop3(t.id, selected.includes(t.id))),
      );

      const top3Titles = openTasks
        .filter((t) => selected.includes(t.id))
        .map((t) => t.title);

      await create({
        body: composeMorningBody({ feeling, top3Titles, avoiding, gratitude }),
        source: "pwa_morning",
      });

      showToast("Morning Setup gespeichert");
      router.push("/journal");
    });
  }

  return (
    <section>
      <p className={FIELD_LABEL}>The Morning Setup</p>
      <h1 className="mt-1 font-serif text-display text-on-surface">
        Morning Setup
      </h1>

      <div className="mt-6 space-y-6">
        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Wie will ich mich heute fühlen? (ein Wort)
          </span>
          <input
            type="text"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <div>
          <span className={`block ${FIELD_LABEL}`}>
            Top 3 Tasks heute ({selected.length}/{MAX_TOP3})
          </span>
          {openTasks.length === 0 ? (
            <p className="mt-2 text-body-sm text-on-surface-muted">
              Keine offenen Aufgaben — leg zuerst eine an.
            </p>
          ) : (
            <ul className="mt-2">
              {openTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-border py-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(t.id)}
                    disabled={
                      !selected.includes(t.id) && selected.length >= MAX_TOP3
                    }
                    onChange={() => toggleTask(t.id)}
                  />
                  <span className="text-body text-on-surface">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="block">
          <span className={`block ${FIELD_LABEL}`}>
            Das Eine, was ich immer wieder vermeide
          </span>
          <input
            type="text"
            value={avoiding}
            onChange={(e) => setAvoiding(e.target.value)}
            className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
          />
        </label>

        <div>
          <span className={`block ${FIELD_LABEL}`}>
            3 Dinge, für die ich dankbar bin
          </span>
          {gratitude.map((g, i) => (
            <input
              key={i}
              type="text"
              value={g}
              onChange={(e) =>
                setGratitude((prev) =>
                  prev.map((v, idx) => (idx === i ? e.target.value : v)),
                )
              }
              className="mt-2 w-full rounded-sm bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-b-2 focus:border-accent"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={pending || !feeling.trim() || !avoiding.trim()}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Speichere…" : "Speichern"}
        </button>
      </div>
    </section>
  );
}
