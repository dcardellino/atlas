import TokenManager from "@/components/features/settings/TokenManager";
import IntegrationStatus from "@/components/features/settings/IntegrationStatus";
import { listTokens } from "@/lib/auth/actions";
import { getSyncState } from "@/lib/calendar/actions";
import { createClient } from "@/lib/supabase/server";

// Settings entry point (TASK-016, TASK-046). Token management (Phase 1) plus the
// integrations status — Supabase / Calendar / ntfy badges, timezone, last sync
// and a force-sync button (Phase 3, FR-010).
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tokens, syncState] = await Promise.all([listTokens(), getSyncState()]);

  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Einstellungen
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Settings</h1>
      <TokenManager initialTokens={tokens} />
      <IntegrationStatus
        data={{
          supabaseConnected: Boolean(user),
          calendar: {
            connected: syncState?.last_synced_at != null,
            lastSyncedAt: syncState?.last_synced_at ?? null,
            error: syncState?.last_error ?? null,
          },
          ntfyConfigured: Boolean(process.env.NTFY_TOPIC_URL),
          timezone: process.env.CAPTURE_TZ ?? "Europe/Berlin",
        }}
      />
    </section>
  );
}
