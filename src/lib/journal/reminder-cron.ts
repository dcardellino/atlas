import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { sendTelegram } from "@/lib/notify/telegram";
import { DEFAULTS } from "./reminder-defaults";

/**
 * Journal-reminder scheduling core. The route (journal-reminders/route.ts) is a
 * thin wrapper around runJournalReminders, mirroring how the calendar-sync route
 * wraps syncCalendarForUser — keeping the logic testable without a live request.
 * *_last_sent_on dedups so a 15-min poll fires at most once a day per threshold.
 *
 * Reminders are on by default (DEFAULTS): we enumerate every user that owns data
 * — distinct owners of `areas`, same source as the calendar-sync cron — and fall
 * back to DEFAULTS for anyone without a saved settings row, so a fresh user gets
 * pushes without having pressed "Speichern". The row is created lazily on the
 * first successful send, which is what carries the *_last_sent_on dedup marker.
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

/** DEFAULTS as a full settings row for a user who has never saved one. */
function defaultRow(userId: string): SettingsRow {
  return {
    user_id: userId,
    ...DEFAULTS,
    morning_last_sent_on: null,
    evening_last_sent_on: null,
  };
}

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
  db: SupabaseClient,
  now: Date,
): Promise<{ sent: number }> {
  const today = formatInTimeZone(now, TZ, "yyyy-MM-dd");
  const nowTime = formatInTimeZone(now, TZ, "HH:mm");

  const { data: settingsData } = await db
    .from("journal_reminder_settings")
    .select("*");
  const byUser = new Map(
    ((settingsData as SettingsRow[]) ?? []).map((r) => [r.user_id, r]),
  );

  // Every user that owns data, same enumeration as the calendar-sync cron.
  const { data: owners } = await db.from("areas").select("user_id");
  const userIds = [
    ...new Set(
      ((owners as { user_id: string }[]) ?? []).map((o) => o.user_id),
    ),
  ];

  let sent = 0;
  for (const userId of userIds) {
    const row = byUser.get(userId) ?? defaultRow(userId);

    // On the upsert, a user without a saved row gets one lazily created with the
    // effective settings (DEFAULTS) plus the dedup stamp; a user with a row has
    // only the stamp touched, leaving their saved values intact. `hasRow` flips
    // to true once we create it, so the evening upsert in the same run doesn't
    // re-seed.
    let hasRow = byUser.has(userId);

    if (
      isDue(row.morning_enabled, row.morning_time, row.morning_last_sent_on, nowTime, today)
    ) {
      const ok = await sendTelegram({
        title: "📝 Morning Journal",
        body: `Zeit fürs Morning Setup.\n${appUrl()}/journal/morning`,
      });
      if (ok) {
        await db.from("journal_reminder_settings").upsert(
          { user_id: userId, ...(hasRow ? {} : DEFAULTS), morning_last_sent_on: today },
          { onConflict: "user_id" },
        );
        hasRow = true;
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
        await db.from("journal_reminder_settings").upsert(
          { user_id: userId, ...(hasRow ? {} : DEFAULTS), evening_last_sent_on: today },
          { onConflict: "user_id" },
        );
        hasRow = true;
        sent++;
      }
    }
  }

  return { sent };
}
