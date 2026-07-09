"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayBoundsUtc } from "@/lib/time/day";
import { getAccessToken, fetchCalendarList } from "./google";
import { syncCalendarForUser } from "./sync";
import type { CalendarEvent, CalendarSyncState } from "./types";

/**
 * Calendar read + control actions (TASK-045/046, FR-010). Reads run under the
 * session client (RLS); the force-sync write path uses the admin client (the
 * cache is system-owned, mirroring the cron). Types live in ./types.
 */

const TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

/** Cached events starting within the user's local day (Today view). */
export async function listTodayEvents(
  now: Date = new Date(),
  tz: string = TZ,
): Promise<CalendarEvent[]> {
  const { supabase, userId } = await requireUser();
  const [startUtc, endUtc] = dayBoundsUtc(now, tz);
  const { data } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", startUtc)
    .lt("start_at", endUtc)
    .order("start_at", { ascending: true });
  return (data as CalendarEvent[]) ?? [];
}

/** Last sync status for the stale/error hint (Today + Settings). */
export async function getSyncState(): Promise<CalendarSyncState | null> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("calendar_sync_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CalendarSyncState) ?? null;
}

/**
 * Force a sync now (Settings "Jetzt synchronisieren"). Never throws to the UI —
 * a failure is captured in calendar_sync_state.last_error and surfaced as a hint.
 */
export async function forceSync(): Promise<void> {
  const { userId } = await requireUser();
  try {
    await syncCalendarForUser(createAdminClient(), userId);
  } catch {
    // last_error is already persisted by syncCalendarForUser.
  }
  revalidatePath("/settings");
  revalidatePath("/today");
}

export type AvailableCalendar = { id: string; summary: string; primary?: boolean };

/**
 * Calendars the connected Google account has, for the Settings selector. Never
 * throws — an unconfigured/broken connection just yields an empty list (the UI
 * hides the selector when this is empty).
 */
export async function listAvailableCalendars(): Promise<AvailableCalendar[]> {
  try {
    const token = await getAccessToken();
    return await fetchCalendarList(token);
  } catch {
    return [];
  }
}

/** Persist the calendar selection and re-sync immediately so it's visible right away. */
export async function updateSelectedCalendars(ids: string[]): Promise<void> {
  const { supabase, userId } = await requireUser();
  const normalized = ids.length > 0 ? ids : ["primary"];
  await supabase
    .from("calendar_sync_state")
    .upsert(
      { user_id: userId, selected_calendar_ids: normalized },
      { onConflict: "user_id" },
    );
  try {
    await syncCalendarForUser(createAdminClient(), userId);
  } catch {
    // last_error is already persisted by syncCalendarForUser.
  }
  revalidatePath("/settings/integrations");
  revalidatePath("/today");
}
