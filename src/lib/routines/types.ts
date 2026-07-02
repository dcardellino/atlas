/**
 * Routine types and constants. Kept out of the "use server" actions file
 * because only async functions may be exported from a Server Actions module —
 * a runtime const like TIMES_OF_DAY would otherwise break the build.
 */

export const TIMES_OF_DAY = [
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export type Routine = {
  id: string;
  area_id: string | null;
  name: string;
  description: string | null;
  time_of_day: TimeOfDay;
  duration_days: number | null;
  /** null = daily routine; 1..7 = target check-offs per ISO week ("N-mal/Woche"). */
  weekly_target: number | null;
  /** null = not per-day; 2..20 = target check-offs per day ("N-mal/Tag"). Exclusive with weekly_target. */
  daily_target: number | null;
  start_date: string;
  archived_at: string | null;
  created_at: string;
};

export type RoutineLog = {
  id: string;
  routine_id: string;
  log_date: string;
  completed: boolean;
  /** Check-offs on that day (≥1); relevant for N-times-per-day routines. */
  count: number;
  created_at: string;
};

/** A routine enriched with its check-off state for the UI / Today view. */
export type RoutineState = {
  routine: Routine;
  loggedToday: boolean;
  /** Consecutive days (daily routines) or consecutive met weeks (weekly routines). */
  streak: number;
  last30: { date: string; done: boolean }[];
  /** Current-week progress for weekly routines; null for daily ones. */
  weeklyProgress: { done: number; target: number } | null;
  /** Today's progress for N-times-per-day routines; null otherwise. */
  dailyProgress: { done: number; target: number } | null;
};
