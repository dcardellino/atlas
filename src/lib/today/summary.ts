import { createClient } from "@/lib/supabase/server";
import { dayBoundsUtc } from "@/lib/time/day";
import type { Task } from "@/lib/tasks/actions";
import { listWithState } from "@/lib/routines/actions";
import type { RoutineState } from "@/lib/routines/types";
import type { CalendarEvent, CalendarState } from "@/lib/calendar/types";

/**
 * Today-View aggregation (TASK-020, FR-003; routines TASK-033; calendar
 * TASK-045).
 *
 * Returns the Phase-1 buckets — Top-3, due today, recently captured — plus the
 * day's active routines (checkable inline, Vision Flow 3) and the read-only
 * Google Calendar events for the day with a connection/stale hint. Runs under
 * the session client.
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
  calendarEvents: CalendarEvent[];
  calendarState: CalendarState;
};

const EMPTY_CALENDAR_STATE: CalendarState = {
  connected: false,
  lastSyncedAt: null,
  error: null,
};

export async function summary(
  now: Date = new Date(),
  tz: string = process.env.CAPTURE_TZ ?? "Europe/Berlin",
): Promise<TodaySummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      top3: [],
      dueToday: [],
      recentInbox: [],
      routines: [],
      calendarEvents: [],
      calendarState: EMPTY_CALENDAR_STATE,
    };

  const [startUtc, endUtc] = dayBoundsUtc(now, tz);

  const [top3Res, dueRes, inboxRes, routines, calRes, syncRes] =
    await Promise.all([
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
      supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .gte("start_at", startUtc)
        .lt("start_at", endUtc)
        .order("start_at", { ascending: true }),
      supabase
        .from("calendar_sync_state")
        .select("last_synced_at, last_error")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const sync = syncRes.data as {
    last_synced_at: string | null;
    last_error: string | null;
  } | null;

  return {
    top3: (top3Res.data as Task[]) ?? [],
    dueToday: (dueRes.data as Task[]) ?? [],
    recentInbox: (inboxRes.data as RecentInboxItem[]) ?? [],
    routines,
    calendarEvents: (calRes.data as CalendarEvent[]) ?? [],
    calendarState: {
      connected: sync?.last_synced_at != null,
      lastSyncedAt: sync?.last_synced_at ?? null,
      error: sync?.last_error ?? null,
    },
  };
}
