"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Single-user email/password login. Self-signup is disabled in the Supabase
// dashboard (PRD §9 Provider Configuration) — there is intentionally no
// sign-up form here.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Anmeldung fehlgeschlagen. E-Mail oder Passwort prüfen.");
      setPending(false);
      return;
    }

    router.push("/today");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-meta uppercase tracking-label text-on-surface-muted">
        Atlas
      </p>
      <h1 className="mt-2 font-serif text-title text-on-surface">Anmelden</h1>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            E-Mail
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-sm border border-border bg-surface-raised px-3 text-body text-on-surface outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Passwort
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-sm border border-border bg-surface-raised px-3 text-body text-on-surface outline-none focus:border-accent"
          />
        </label>

        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
        >
          {pending ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
