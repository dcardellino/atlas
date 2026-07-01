import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { sendNtfy } from "@/lib/notify/ntfy";

/**
 * Reminder cron (TASK-042, FR-009). Finds open tasks whose `reminder_at` is due
 * and not yet notified, pushes one ntfy message each, then stamps
 * `reminder_sent_at` so a later run never re-sends (de-dup via 0006). Runs
 * system-side with the admin client; secured by CRON_SECRET.
 *
 * Triggered by the GitHub Actions scheduler (.github/workflows/cron.yml) every
 * ~15 min — Vercel Hobby cron is limited to daily, so it is not used here.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await db
    .from("tasks")
    .select("id, title")
    .eq("status", "open")
    .is("reminder_sent_at", null)
    .not("reminder_at", "is", null)
    .lte("reminder_at", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  for (const task of due ?? []) {
    const ok = await sendNtfy({
      title: "Erinnerung",
      body: task.title as string,
      tags: ["bell"],
    });
    // Only stamp on a successful push, so a transient ntfy failure retries next
    // run rather than silently dropping the reminder.
    if (ok) {
      await db
        .from("tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id);
      sent++;
    }
  }

  return NextResponse.json({ due: due?.length ?? 0, sent });
}
