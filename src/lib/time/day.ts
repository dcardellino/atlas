import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * [startUtc, endUtc) ISO instants covering the user's local calendar day.
 * Shared by the Today summary, the daily-summary cron and the calendar view so
 * "today" means the same wall-clock day everywhere (TASK-020/043/045).
 */
export function dayBoundsUtc(now: Date, tz: string): [string, string] {
  const localDate = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const start = fromZonedTime(`${localDate}T00:00:00`, tz);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return [start.toISOString(), end.toISOString()];
}
