import TokenManager from "@/components/features/settings/TokenManager";
import { listTokens } from "@/lib/auth/actions";

// Settings entry point (TASK-016). Token management lands in Phase 1; calendar/
// ntfy/integration status follow in Phase 3.
export default async function SettingsPage() {
  const tokens = await listTokens();
  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Einstellungen
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Settings</h1>
      <TokenManager initialTokens={tokens} />
    </section>
  );
}
