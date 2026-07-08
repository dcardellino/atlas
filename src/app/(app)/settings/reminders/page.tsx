import SettingsHeader from "@/components/features/settings/SettingsHeader";
import ReminderStatus from "@/components/features/settings/ReminderStatus";
import JournalReminderSettings from "@/components/features/settings/JournalReminderSettings";
import { getLastReminderSentAt } from "@/lib/tasks/actions";
import { getReminderSettings } from "@/lib/journal/reminder-settings";

export default async function SettingsRemindersPage() {
  const [lastSentAt, reminderSettings] = await Promise.all([
    getLastReminderSentAt(),
    getReminderSettings(),
  ]);
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
      <JournalReminderSettings initial={reminderSettings} />
    </section>
  );
}
