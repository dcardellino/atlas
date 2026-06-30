/**
 * Routine streak computation (TASK-030, FR-007).
 *
 * Pure functions over date-only strings ("yyyy-MM-dd") so they are unit-testable
 * without a database or a timezone. `log_date` is a bare DATE in the DB; the
 * caller resolves "today" in the user timezone before calling in.
 */

/** Add `delta` calendar days to a "yyyy-MM-dd" string (UTC-anchored, tz-safe). */
export function addDaysIso(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Current streak: the run of consecutive logged days ending at `today` (or, if
 * today isn't logged yet, ending at yesterday — an undone "today" doesn't break
 * an otherwise-active streak). A missing day breaks it; duplicates are ignored.
 */
export function currentStreak(logDates: string[], today: string): number {
  const set = new Set(logDates);

  let cursor = today;
  if (!set.has(cursor)) {
    cursor = addDaysIso(today, -1);
    if (!set.has(cursor)) return 0;
  }

  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDaysIso(cursor, -1);
  }
  return count;
}

/**
 * The last `days` calendar dates ending at `today`, oldest → newest, each tagged
 * with whether the routine was logged that day. Drives StreakChart (TASK-034).
 */
export function lastNDays(
  logDates: string[],
  today: string,
  days: number,
): { date: string; done: boolean }[] {
  const set = new Set(logDates);
  const out: { date: string; done: boolean }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysIso(today, -i);
    out.push({ date, done: set.has(date) });
  }
  return out;
}
