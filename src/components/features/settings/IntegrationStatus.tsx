"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { forceSync } from "@/lib/calendar/actions";

/**
 * Integrations status (TASK-046). Status badges for Supabase, Google Calendar
 * and Telegram, plus the configured timezone, last calendar sync and a force-sync
 * button. Uses the semantic status tokens (success/warning/danger) — never the
 * rust accent, which is reserved for focus/star/overdue (docs/design.md).
 */

const TZ = "Europe/Berlin";

export type IntegrationStatusData = {
  supabaseConnected: boolean;
  calendar: { connected: boolean; lastSyncedAt: string | null; error: string | null };
  telegramConfigured: boolean;
  timezone: string;
};

type Tone = "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-meta uppercase tracking-label ${toneClass[tone]}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

function Row({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-3">
      <span className="flex-1 text-body text-on-surface">{name}</span>
      {children}
    </li>
  );
}

export default function IntegrationStatus({
  data,
}: {
  data: IntegrationStatusData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const calendarBadge = data.calendar.error ? (
    <StatusBadge tone="warning" label="Fehler" />
  ) : data.calendar.connected ? (
    <StatusBadge tone="success" label="Verbunden" />
  ) : (
    <StatusBadge tone="danger" label="Nicht verbunden" />
  );

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Integrationen
      </p>

      <ul className="mt-3">
        <Row name="Supabase">
          <StatusBadge
            tone={data.supabaseConnected ? "success" : "danger"}
            label={data.supabaseConnected ? "Verbunden" : "Getrennt"}
          />
        </Row>
        <Row name="Google Calendar">{calendarBadge}</Row>
        <Row name="Telegram">
          <StatusBadge
            tone={data.telegramConfigured ? "success" : "warning"}
            label={data.telegramConfigured ? "Konfiguriert" : "Nicht gesetzt"}
          />
        </Row>
        <Row name="Zeitzone">
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {data.timezone}
          </span>
        </Row>
        <Row name="Letzter Kalender-Sync">
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {data.calendar.lastSyncedAt
              ? formatInTimeZone(
                  new Date(data.calendar.lastSyncedAt),
                  TZ,
                  "dd.MM.yyyy HH:mm",
                )
              : "—"}
          </span>
        </Row>
      </ul>

      {data.calendar.error && (
        <p role="alert" className="mt-3 text-body-sm text-on-surface-muted">
          Letzter Sync-Fehler: {data.calendar.error}
        </p>
      )}

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await forceSync();
            router.refresh();
          })
        }
        disabled={pending}
        className="mt-4 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
      >
        {pending ? "Synchronisiere…" : "Jetzt synchronisieren"}
      </button>
    </section>
  );
}
