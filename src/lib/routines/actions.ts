"use server";

import { revalidatePath } from "next/cache";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import {
  addDaysIso,
  currentStreak,
  daysMeetingTarget,
  lastNDays,
  weeklyProgress,
  weeklyStreak,
} from "@/lib/routines/streak";
import type {
  Routine,
  RoutineLog,
  RoutineState,
  TimeOfDay,
} from "@/lib/routines/types";

/**
 * Routines data access (TASK-029/031, FR-007). Server actions under the session
 * client (RLS). Daily check-off writes `routine_logs` (one row per day, enforced
 * by UNIQUE(routine_id, log_date) → idempotent). Time-boxed routines
 * (`duration_days`) auto-archive once their window has elapsed.
 *
 * Types and the TIMES_OF_DAY constant live in ./types (a Server Actions module
 * may only export async functions). Note: `routines` has no
 * `sort_order`/`updated_at` columns.
 */

const DEFAULT_TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

function todayIso(now: Date, tz: string): string {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** A time-boxed routine is expired once `start_date + duration_days` has passed. */
function isExpired(r: Routine, today: string): boolean {
  if (r.duration_days == null) return false;
  return today >= addDaysIso(r.start_date, r.duration_days);
}

export async function create(input: {
  name: string;
  description?: string | null;
  time_of_day?: TimeOfDay;
  duration_days?: number | null;
  weekly_target?: number | null;
  daily_target?: number | null;
  area_id?: string | null;
}): Promise<Routine> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      description: input.description ?? null,
      time_of_day: input.time_of_day ?? "anytime",
      duration_days: input.duration_days ?? null,
      weekly_target: input.weekly_target ?? null,
      daily_target: input.daily_target ?? null,
      area_id: input.area_id ?? null,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "could not create routine");
  revalidatePath("/routines");
  revalidatePath("/today");
  return data as Routine;
}

export async function update(
  id: string,
  patch: Partial<
    Pick<
      Routine,
      | "name"
      | "description"
      | "time_of_day"
      | "duration_days"
      | "weekly_target"
      | "daily_target"
      | "area_id"
    >
  >,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("routines")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/routines");
  revalidatePath("/today");
}

/**
 * Delete a routine permanently. Its `routine_logs` (streak history) are removed
 * by the DB FK (`ON DELETE CASCADE`). Note: time-boxed routines still auto-hide
 * once expired via `archiveExpired` below — this is the explicit user action.
 */
export async function remove(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("routines").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/routines");
  revalidatePath("/today");
}

/**
 * Idempotently record today's completion (FR-007). The UNIQUE(routine_id,
 * log_date) constraint makes a repeated call a no-op rather than a duplicate.
 */
export async function logToday(
  routineId: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("routine_logs").upsert(
    {
      user_id: userId,
      routine_id: routineId,
      log_date: todayIso(now, tz),
      completed: true,
    },
    { onConflict: "routine_id,log_date", ignoreDuplicates: true },
  );
  revalidatePath("/routines");
  revalidatePath("/today");
}

/** Undo today's check-off (the toggle's "off" path). */
export async function unlogToday(
  routineId: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("routine_logs")
    .delete()
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("log_date", todayIso(now, tz));
  revalidatePath("/routines");
  revalidatePath("/today");
}

/**
 * Set today's check-off count for an N-times-per-day routine. The UI computes the
 * next value (cyclic +1, wrapping to 0 at the target); `count <= 0` clears the day
 * (delete the row), `count > 0` upserts it. Unlike `logToday`, this upsert updates
 * `count` on conflict (no `ignoreDuplicates`).
 */
export async function setTodayCount(
  routineId: string,
  count: number,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  const log_date = todayIso(now, tz);
  if (count <= 0) {
    await supabase
      .from("routine_logs")
      .delete()
      .eq("user_id", userId)
      .eq("routine_id", routineId)
      .eq("log_date", log_date);
  } else {
    await supabase.from("routine_logs").upsert(
      { user_id: userId, routine_id: routineId, log_date, completed: true, count },
      { onConflict: "routine_id,log_date" },
    );
  }
  revalidatePath("/routines");
  revalidatePath("/today");
}

/** Lazily archive any time-boxed routines whose window has elapsed (TASK-031). */
async function archiveExpired(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  routines: Routine[],
  today: string,
): Promise<Routine[]> {
  const expired = routines.filter((r) => isExpired(r, today));
  if (expired.length > 0) {
    const stamp = new Date().toISOString();
    await Promise.all(
      expired.map((r) =>
        supabase
          .from("routines")
          .update({ archived_at: stamp })
          .eq("id", r.id)
          .eq("user_id", userId),
      ),
    );
  }
  const expiredIds = new Set(expired.map((r) => r.id));
  return routines.filter((r) => !expiredIds.has(r.id));
}

/**
 * Active routines enriched with check-off state. Runs the lazy auto-archive
 * pass first, then groups logs (one query) to compute streaks and the 30-day
 * history. Shared by the Routines screen and the Today view (TASK-032/033).
 */
export async function listWithState(
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<RoutineState[]> {
  const { supabase, userId } = await requireUser();
  const today = todayIso(now, tz);

  const [routinesRes, logsRes] = await Promise.all([
    supabase
      .from("routines")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    supabase
      .from("routine_logs")
      .select("routine_id, log_date, count")
      .eq("user_id", userId)
      .order("log_date", { ascending: false }),
  ]);

  const active = await archiveExpired(
    supabase,
    userId,
    (routinesRes.data as Routine[]) ?? [],
    today,
  );

  // Group logs (date + per-day count) by routine.
  const byRoutine = new Map<string, { date: string; count: number }[]>();
  for (const log of (logsRes.data ?? []) as Pick<
    RoutineLog,
    "routine_id" | "log_date" | "count"
  >[]) {
    const arr = byRoutine.get(log.routine_id) ?? [];
    arr.push({ date: log.log_date, count: log.count });
    byRoutine.set(log.routine_id, arr);
  }

  return active.map((routine) => {
    const logs = byRoutine.get(routine.id) ?? [];
    const dates = logs.map((l) => l.date);

    // N-times-per-day: a day is "done" only once its count reaches the target.
    if (routine.daily_target != null) {
      const target = routine.daily_target;
      const doneDates = daysMeetingTarget(logs, target);
      const todayCount = logs.find((l) => l.date === today)?.count ?? 0;
      return {
        routine,
        loggedToday: todayCount >= target,
        streak: currentStreak(doneDates, today),
        last30: lastNDays(doneDates, today, 30),
        weeklyProgress: null,
        dailyProgress: { done: todayCount, target },
      };
    }

    // N-times-per-week vs. plain daily — presence of a day is enough.
    const target = routine.weekly_target;
    return {
      routine,
      loggedToday: dates.includes(today),
      streak:
        target == null
          ? currentStreak(dates, today)
          : weeklyStreak(dates, today, target),
      last30: lastNDays(dates, today, 30),
      weeklyProgress:
        target == null ? null : { done: weeklyProgress(dates, today), target },
      dailyProgress: null,
    };
  });
}

/**
 * Current streak for a single routine (API spec: routines.streak). Daily routines
 * count consecutive days; weekly routines (weekly_target set) count consecutive
 * weeks that met the target.
 */
export async function streak(
  routineId: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TZ,
): Promise<number> {
  const { supabase, userId } = await requireUser();
  const [routineRes, logsRes] = await Promise.all([
    supabase
      .from("routines")
      .select("weekly_target, daily_target")
      .eq("user_id", userId)
      .eq("id", routineId)
      .single(),
    supabase
      .from("routine_logs")
      .select("log_date, count")
      .eq("user_id", userId)
      .eq("routine_id", routineId),
  ]);
  const logs = (logsRes.data ?? []).map((l) => ({
    date: l.log_date as string,
    count: l.count as number,
  }));
  const today = todayIso(now, tz);
  const routine = routineRes.data as {
    weekly_target: number | null;
    daily_target: number | null;
  } | null;

  if (routine?.daily_target != null) {
    return currentStreak(daysMeetingTarget(logs, routine.daily_target), today);
  }
  const dates = logs.map((l) => l.date);
  return routine?.weekly_target == null
    ? currentStreak(dates, today)
    : weeklyStreak(dates, today, routine.weekly_target);
}
