import SettingsHeader from "@/components/features/settings/SettingsHeader";
import ReminderStatus from "@/components/features/settings/ReminderStatus";
import { getLastReminderSentAt } from "@/lib/tasks/actions";

export default async function SettingsRemindersPage() {
  const lastSentAt = await getLastReminderSentAt();
  return (
    <section>
      <SettingsHeader title="Journal-Erinnerungen" />
      <ReminderStatus
        data={{
          telegramConfigured: Boolean(
            process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID,
          ),
          lastSentAt,
        }}
      />
    </section>
  );
}
