import { formatInTimeZone } from "date-fns-tz";

const TZ = "Europe/Berlin";

export type ReminderStatusData = {
  telegramConfigured: boolean;
  lastSentAt: string | null;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-meta uppercase tracking-label ${
        ok ? "text-success" : "text-warning"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export default function ReminderStatus({ data }: { data: ReminderStatusData }) {
  return (
    <section className="mt-8">
      <ul>
        <li className="flex items-center gap-3 border-b border-border py-3">
          <span className="flex-1 text-body text-on-surface">Telegram</span>
          <StatusBadge
            ok={data.telegramConfigured}
            label={data.telegramConfigured ? "Konfiguriert" : "Nicht gesetzt"}
          />
        </li>
        <li className="flex items-center gap-3 border-b border-border py-3">
          <span className="flex-1 text-body text-on-surface">
            Letzte Erinnerung
          </span>
          <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {data.lastSentAt
              ? formatInTimeZone(new Date(data.lastSentAt), TZ, "dd.MM.yyyy HH:mm")
              : "—"}
          </span>
        </li>
      </ul>
    </section>
  );
}
