import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { sendTelegram } from "@/lib/notify/telegram";

/**
 * Journal-reminder scheduling core. The route (journal-reminders/route.ts) is a
 * thin wrapper around runJournalReminders, mirroring how the calendar-sync route
 * wraps syncCalendarForUser — keeping the logic testable without a live request.
 * *_last_sent_on dedups so a 15-min poll fires at most once a day per threshold.
 */

const TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

type SettingsRow = {
  user_id: string;
  morning_enabled: boolean;
  morning_time: string;
  morning_last_sent_on: string | null;
  evening_enabled: boolean;
  evening_time: string;
  evening_last_sent_on: string | null;
};

export type ReminderDb = {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: unknown; error: unknown }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: unknown }>;
    };
  };
};

export function isDue(
  enabled: boolean,
  configuredTime: string,
  lastSentOn: string | null,
  nowTime: string,
  today: string,
): boolean {
  if (!enabled) return false;
  if (lastSentOn === today) return false;
  return nowTime >= configuredTime.slice(0, 5);
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

export async function runJournalReminders(
  db: ReminderDb,
  now: Date,
): Promise<{ sent: number }> {
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const nowTime = formatInTimeZone(now, TZ, "HH:mm");

  const { data } = await db.from("journal_reminder_settings").select("*");
  const rows = (data as SettingsRow[]) ?? [];

  let sent = 0;
  for (const row of rows) {
    if (
      isDue(row.morning_enabled, row.morning_time, row.morning_last_sent_on, nowTime, today)
    ) {
      const ok = await sendTelegram({
        title: "📝 Morning Journal",
        body: `Zeit fürs Morning Setup.\n${appUrl()}/journal/morning`,
      });
      if (ok) {
        await db
          .from("journal_reminder_settings")
          .update({ morning_last_sent_on: today })
          .eq("user_id", row.user_id);
        sent++;
      }
    }

    if (
      isDue(row.evening_enabled, row.evening_time, row.evening_last_sent_on, nowTime, today)
    ) {
      const ok = await sendTelegram({
        title: "🌙 Evening Close",
        body: `Zeit für deinen Rückblick.\n${appUrl()}/journal/evening`,
      });
      if (ok) {
        await db
          .from("journal_reminder_settings")
          .update({ evening_last_sent_on: today })
          .eq("user_id", row.user_id);
        sent++;
      }
    }
  }

  return { sent };
}
