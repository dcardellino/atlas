"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateReminderSettings,
  type ReminderSettings,
} from "@/lib/journal/reminder-settings";
import { useToast } from "@/components/ui/Toast";

/**
 * Settings section for the Morning Setup / Evening Close Telegram reminders —
 * on/off + time per reminder. First editable settings form in the app (the
 * existing sections are read-only status displays).
 */

function Row({
  label,
  enabled,
  onToggle,
  time,
  onTimeChange,
}: {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  time: string;
  onTimeChange: (value: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <label className="flex flex-1 items-center gap-2 text-body text-on-surface">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {label}
      </label>
      <input
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        className="h-9 rounded-sm border border-border bg-surface px-2 text-body text-on-surface outline-none focus:border-accent"
      />
    </li>
  );
}

export default function JournalReminderSettings({
  initial,
}: {
  initial: ReminderSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { show: showToast } = useToast();

  function save() {
    if (pending) return;
    startTransition(async () => {
      await updateReminderSettings(settings);
      router.refresh();
      showToast("Erinnerungen gespeichert");
    });
  }

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Journal-Erinnerungen
      </p>

      <ul className="mt-3">
        <Row
          label="Morning Setup"
          enabled={settings.morning_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, morning_enabled: v }))}
          time={settings.morning_time}
          onTimeChange={(v) => setSettings((s) => ({ ...s, morning_time: v }))}
        />
        <Row
          label="Evening Close"
          enabled={settings.evening_enabled}
          onToggle={(v) => setSettings((s) => ({ ...s, evening_enabled: v }))}
          time={settings.evening_time}
          onTimeChange={(v) => setSettings((s) => ({ ...s, evening_time: v }))}
        />
      </ul>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="mt-4 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Speichere…" : "Speichern"}
      </button>
    </section>
  );
}
