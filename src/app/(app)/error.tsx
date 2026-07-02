"use client";

/**
 * App error boundary (TASK-051). Catches render/data errors within the (app)
 * segment and offers an inline retry via `reset()`. Tone stays sachlich und
 * lösungsorientiert (Vision § Voice & Tone) — no apology, no emoji. Capture
 * itself persists raw text before classification, so a thrown error here never
 * means lost input (PRD § Reliability).
 */
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Fehler
      </p>
      <h1 className="mt-1 font-serif text-title text-on-surface">
        Etwas ist schiefgelaufen.
      </h1>
      <p className="mt-2 text-body text-on-surface-muted">
        Der Bereich konnte nicht geladen werden. Nichts ist verloren — versuch es
        gleich noch einmal.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
      >
        Neu laden
      </button>
    </section>
  );
}
