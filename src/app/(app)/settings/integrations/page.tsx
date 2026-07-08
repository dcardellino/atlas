import SettingsHeader from "@/components/features/settings/SettingsHeader";
import IntegrationStatus from "@/components/features/settings/IntegrationStatus";
import { getSyncState } from "@/lib/calendar/actions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsIntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const syncState = await getSyncState();

  return (
    <section>
      <SettingsHeader title="Integrationen" />
      <IntegrationStatus
        data={{
          supabaseConnected: Boolean(user),
          calendar: {
            connected: syncState?.last_synced_at != null,
            lastSyncedAt: syncState?.last_synced_at ?? null,
            error: syncState?.last_error ?? null,
          },
          telegramConfigured: Boolean(
            process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
          ),
          timezone: process.env.CAPTURE_TZ ?? "Europe/Berlin",
        }}
      />
    </section>
  );
}
