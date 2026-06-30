"use client";

import { useState, useTransition } from "react";
import {
  createToken,
  revokeToken,
  type TokenSummary,
} from "@/lib/auth/actions";

/**
 * Shortcut-token management UI (TASK-016, FR-006). Create shows the plaintext
 * exactly once in a code block; afterwards only label/usage are listed. Revoke
 * deletes. Styling reuses the design tokens (no hardcoded values).
 */

const codeBox =
  "mt-2 break-all rounded-sm border border-border bg-surface px-3 py-2 font-mono text-body-sm text-on-surface";

export default function TokenManager({
  initialTokens,
}: {
  initialTokens: TokenSummary[];
}) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate() {
    startTransition(async () => {
      const { id, plaintext } = await createToken(label);
      setPlaintext(plaintext);
      setTokens((prev) => [
        {
          id,
          label: label.trim() || null,
          last_used_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setLabel("");
    });
  }

  function onRevoke(id: string) {
    startTransition(async () => {
      await revokeToken(id);
      setTokens((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Shortcut-Tokens
      </p>

      <div className="mt-3 flex items-end gap-3">
        <label className="flex-1">
          <span className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Label
          </span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="z.B. iPhone"
            className="mt-1 h-11 w-full rounded-sm border border-border bg-surface-raised px-3 text-body text-on-surface outline-none focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          disabled={pending}
          className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          Erzeugen
        </button>
      </div>

      {plaintext && (
        <div className="mt-4 rounded-md border border-accent bg-surface-raised p-md">
          <p className="text-body-sm text-on-surface">
            Token wird nur jetzt angezeigt — kopieren und sicher hinterlegen.
          </p>
          <code className={codeBox}>{plaintext}</code>
          <button
            type="button"
            onClick={() => setPlaintext(null)}
            className="mt-3 h-9 rounded-sm bg-surface px-4 font-mono text-meta uppercase tracking-label text-on-surface"
          >
            Verstanden
          </button>
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="mt-4 text-body-sm text-on-surface-muted">
          Noch kein Token. Erzeuge eines für den iOS-Shortcut.
        </p>
      ) : (
        <ul className="mt-4">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border-b border-border py-3"
            >
              <span className="flex-1 text-body text-on-surface">
                {t.label ?? "Ohne Label"}
              </span>
              <span className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
                {t.last_used_at ? "benutzt" : "ungenutzt"}
              </span>
              <button
                type="button"
                onClick={() => onRevoke(t.id)}
                disabled={pending}
                className="font-mono text-meta uppercase tracking-label text-danger"
              >
                Widerrufen
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
