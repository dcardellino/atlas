"use client";

import "./globals.css";

/**
 * Root error boundary (TASK-051). Only fires when the root layout itself throws,
 * so it must render its own <html>/<body>. Fonts (CSS vars from next/font) may be
 * absent here — the Tailwind fallbacks (Georgia/ui-monospace) keep it readable.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body className="bg-surface text-on-surface">
        <main
          role="alert"
          className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center px-5 py-6"
        >
          <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Fehler
          </p>
          <h1 className="mt-1 font-serif text-title text-on-surface">
            Atlas ist kurz gestolpert.
          </h1>
          <p className="mt-2 text-body text-on-surface-muted">
            Lade die App neu — deine Daten sind sicher.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 h-11 w-fit rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
          >
            Neu laden
          </button>
        </main>
      </body>
    </html>
  );
}
