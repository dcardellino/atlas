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
  specific_time: string | null;
  notify: boolean;
  duration_days: number | null;
  start_date: string;
  archived_at: string | null;
  created_at: string;
};

export type RoutineLog = {
  id: string;
  routine_id: string;
  log_date: string;
  completed: boolean;
  created_at: string;
};

/** A routine enriched with its check-off state for the UI / Today view. */
export type RoutineState = {
  routine: Routine;
  loggedToday: boolean;
  streak: number;
  last30: { date: string; done: boolean }[];
};
