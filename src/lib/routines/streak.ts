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
 * Monday (ISO week start) of the week containing `date`. UTC-anchored via
 * `getUTCDay()` (0 = Sunday … 6 = Saturday); `(day + 6) % 7` is the number of
 * days since Monday.
 */
export function isoWeekStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const offset = (day + 6) % 7;
  return addDaysIso(date, -offset);
}

/**
 * Number of *distinct* logged days inside the ISO week `[weekStart, weekStart+6]`.
 * Duplicate log dates count once; the check-off boolean of a gym-style routine is
 * "did it happen that day", so multiple logs on one day are still one day.
 */
export function weeklyCount(logDates: string[], weekStart: string): number {
  const end = addDaysIso(weekStart, 6);
  const seen = new Set<string>();
  for (const d of logDates) {
    if (d >= weekStart && d <= end) seen.add(d);
  }
  return seen.size;
}

/** Distinct logged days in the week containing `today` (drives "3/4 diese Woche"). */
export function weeklyProgress(logDates: string[], today: string): number {
  return weeklyCount(logDates, isoWeekStart(today));
}

/**
 * Weekly streak: consecutive weeks that met `target` check-offs, ending at the
 * current week (or, if the running week hasn't hit the target yet, ending at the
 * previous week — an unfinished week doesn't break an otherwise-active streak,
 * mirroring {@link currentStreak}).
 */
export function weeklyStreak(
  logDates: string[],
  today: string,
  target: number,
): number {
  if (target <= 0) return 0;

  let cursor = isoWeekStart(today);
  if (weeklyCount(logDates, cursor) < target) {
    cursor = addDaysIso(cursor, -7);
    if (weeklyCount(logDates, cursor) < target) return 0;
  }

  let count = 0;
  while (weeklyCount(logDates, cursor) >= target) {
    count++;
    cursor = addDaysIso(cursor, -7);
  }
  return count;
}

/**
 * The dates whose per-day count reached `target` — the "done" days of an
 * N-times-per-day routine. Feeding these into {@link currentStreak} /
 * {@link lastNDays} reuses the daily-streak logic: a day only counts once its
 * target is met, and an unfinished today doesn't break the streak.
 */
export function daysMeetingTarget(
  logs: { date: string; count: number }[],
  target: number,
): string[] {
  return logs.filter((l) => l.count >= target).map((l) => l.date);
}

/**
 * The next check-off value for an N-times-per-day routine: +1 until the target is
 * reached, then wrap back to 0 (the "tap to correct" affordance).
 */
export function nextCount({
  done,
  target,
}: {
  done: number;
  target: number;
}): number {
  return done >= target ? 0 : done + 1;
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
