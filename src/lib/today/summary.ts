import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/tasks/actions";
import { listWithState } from "@/lib/routines/actions";
import type { RoutineState } from "@/lib/routines/types";

/**
 * Today-View aggregation (TASK-020, FR-003; routines TASK-033).
 *
 * Returns the Phase-1 buckets — Top-3, due today, recently captured — plus the
 * day's active routines (checkable inline, Vision Flow 3). Calendar events
 * follow in Phase 3 (TASK-045). Runs under the session client.
 */

export type RecentInboxItem = {
  id: string;
  raw_text: string;
  classified_type: string | null;
  status: string;
  created_at: string;
};

export type TodaySummary = {
  top3: Task[];
  dueToday: Task[];
  recentInbox: RecentInboxItem[];
  routines: RoutineState[];
};

/** [startUtc, endUtc) covering the user's local calendar day. */
function dayBoundsUtc(now: Date, tz: string): [string, string] {
  const localDate = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const start = fromZonedTime(`${localDate}T00:00:00`, tz);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return [start.toISOString(), end.toISOString()];
}

export async function summary(
  now: Date = new Date(),
  tz: string = process.env.CAPTURE_TZ ?? "Europe/Berlin",
): Promise<TodaySummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { top3: [], dueToday: [], recentInbox: [], routines: [] };

  const [startUtc, endUtc] = dayBoundsUtc(now, tz);

  const [top3Res, dueRes, inboxRes, routines] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .eq("is_top3", true)
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .gte("due_at", startUtc)
      .lt("due_at", endUtc)
      .order("due_at", { ascending: true }),
    supabase
      .from("inbox_items")
      .select("id, raw_text, classified_type, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    listWithState(now, tz),
  ]);

  return {
    top3: (top3Res.data as Task[]) ?? [],
    dueToday: (dueRes.data as Task[]) ?? [],
    recentInbox: (inboxRes.data as RecentInboxItem[]) ?? [],
    routines,
  };
}
