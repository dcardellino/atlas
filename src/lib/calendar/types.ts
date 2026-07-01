/**
 * Calendar types (TASK-044/045, FR-010). Mirror the read-only cache tables
 * `calendar_events` / `calendar_sync_state` (0006_reminders_calendar.sql).
 */

export type CalendarEvent = {
  id: string;
  external_id: string;
  calendar_id: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  html_link: string | null;
  updated_at: string | null;
  synced_at: string;
};

export type CalendarSyncState = {
  user_id: string;
  last_synced_at: string | null;
  last_error: string | null;
};

/** What the Today view needs to render the calendar section + stale/error hint. */
export type CalendarState = {
  connected: boolean;
  lastSyncedAt: string | null;
  error: string | null;
};
