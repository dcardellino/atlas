import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessToken, fetchEvents, normalizeEvent } from "./google";

/**
 * Sync a user's primary Google Calendar into the read-only cache (TASK-044,
 * FR-010). Fetches a rolling window (yesterday … +30d), upserts each event with
 * a fresh `synced_at`, then prunes any cache row this run didn't touch (deleted
 * or out-of-window). On any failure the previous cache is left intact and
 * `last_error` is recorded so the UI can show a stale hint (Edge Cases).
 *
 * Takes the db client + fetch as params so it is unit-testable and works from
 * both the cron (admin client) and the Settings force-sync action.
 */
export async function syncCalendarForUser(
  db: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<{ synced: number }> {
  const day = 24 * 60 * 60 * 1000;
  const timeMin = new Date(now.getTime() - day).toISOString();
  const timeMax = new Date(now.getTime() + 30 * day).toISOString();
  const syncedAt = now.toISOString();

  try {
    const token = await getAccessToken(process.env, fetchImpl);
    const events = await fetchEvents(token, timeMin, timeMax, fetchImpl);
    const rows = events
      .map(normalizeEvent)
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => ({ ...e, user_id: userId, synced_at: syncedAt }));

    if (rows.length > 0) {
      await db
        .from("calendar_events")
        .upsert(rows, { onConflict: "user_id,external_id" });
    }

    // Any row not refreshed this run fell out of the window / was deleted.
    await db
      .from("calendar_events")
      .delete()
      .eq("user_id", userId)
      .lt("synced_at", syncedAt);

    await db
      .from("calendar_sync_state")
      .upsert(
        { user_id: userId, last_synced_at: syncedAt, last_error: null },
        { onConflict: "user_id" },
      );

    return { synced: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Keep the last cache; only record the failure (Stale-Hinweis, Edge Case P2).
    await db
      .from("calendar_sync_state")
      .upsert(
        { user_id: userId, last_error: message },
        { onConflict: "user_id" },
      );
    throw err;
  }
}
