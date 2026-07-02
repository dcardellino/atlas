"use client";

/**
 * Bestätigungsdialog für destruktive Aktionen (z. B. Löschen). Liegt als eigenes
 * Overlay über einem geöffneten Editor-Modal (höherer z-index). Bewusst schlicht:
 * eine Meldung plus "Abbrechen" und ein als gefährlich markierter Bestätigen-Button.
 */

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Löschen",
  onConfirm,
  onCancel,
  pending = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-on-surface/30 px-4 pt-24"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>{title}</p>
        <p className="mt-3 text-body text-on-surface">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="h-11 rounded-sm bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface disabled:opacity-60"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-11 rounded-sm px-4 font-mono text-label uppercase tracking-label text-danger disabled:opacity-60"
          >
            {pending ? "Löschen…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
