"use client";

import { useState, useTransition } from "react";
import {
  updateSelectedCalendars,
  type AvailableCalendar,
} from "@/lib/calendar/actions";
import { useToast } from "@/components/ui/Toast";

export default function CalendarSelector({
  calendars,
  initialSelected,
}: {
  calendars: AvailableCalendar[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function onSave() {
    startTransition(async () => {
      await updateSelectedCalendars(selected);
      showToast("Kalenderauswahl gespeichert");
    });
  }

  if (calendars.length === 0) return null;

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Kalender-Auswahl
      </p>
      <ul className="mt-3">
        {calendars.map((cal) => (
          <li
            key={cal.id}
            className="flex items-center gap-3 border-b border-border py-3"
          >
            <input
              type="checkbox"
              id={`cal-${cal.id}`}
              checked={selected.includes(cal.id)}
              onChange={() => toggle(cal.id)}
              className="h-4 w-4 accent-accent"
            />
            <label
              htmlFor={`cal-${cal.id}`}
              className="flex-1 text-body text-on-surface"
            >
              {cal.summary}
              {cal.primary && (
                <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
                  primär
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="mt-4 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Speichere…" : "Speichern"}
      </button>
    </section>
  );
}
