import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runJournalReminders, type ReminderDb } from "@/lib/journal/reminder-cron";

/**
 * Journal-reminder cron. Same shape as reminders/daily-summary/calendar-sync:
 * triggered every 15 min by Supabase pg_cron (0016_journal_reminder_settings.sql),
 * secured by CRON_SECRET. All due/dedup logic lives in reminder-cron.ts, already
 * covered by its own unit tests — this route is a thin, untested wrapper, same as
 * the three existing cron routes.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const result = await runJournalReminders(db as unknown as ReminderDb, new Date());
  return NextResponse.json(result);
}
