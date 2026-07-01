import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { syncCalendarForUser } from "@/lib/calendar/sync";

/**
 * Calendar-sync cron (TASK-044, FR-010). Refreshes the read-only event cache for
 * every user that owns data (single-user MVP: distinct owners of areas, seeded
 * on first login). A per-user failure is recorded and skipped — it never fails
 * the whole run, and the previous cache stays visible (Edge Cases). Secured by
 * CRON_SECRET. Triggered by the GitHub Actions scheduler
 * (.github/workflows/cron.yml); Vercel Hobby cron is limited to daily.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: owners } = await db.from("areas").select("user_id");
  const userIds = [
    ...new Set((owners ?? []).map((o) => o.user_id as string)),
  ];

  const results: { userId: string; synced?: number; error?: string }[] = [];
  for (const userId of userIds) {
    try {
      const { synced } = await syncCalendarForUser(db, userId);
      results.push({ userId, synced });
    } catch (err) {
      results.push({
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ users: userIds.length, results });
}
