/**
 * Workout-Statistiken und persönliche Rekorde (PRs).
 *
 * Rein und unit-testbar: die Funktionen arbeiten auf einfachen Zeilen-Arrays
 * (kein DB-/Zeitzonen-Kontext), damit sie sowohl vom Server (Stats-Seite) als
 * auch von Client-Chart-Komponenten importiert werden können. PRs werden BEIM
 * LESEN abgeleitet — es gibt kein gespeichertes is_pr-Flag, das bei Edit/Delete
 * veralten könnte. e1RM per Epley-Formel: weight * (1 + reps/30).
 */

import { isoWeekStart } from "@/lib/routines/streak";

// Minimal-Sichten der DB-Zeilen, die die Statistik braucht.
export type StatWorkout = {
  id: string;
  performed_on: string; // yyyy-MM-dd
  type: string;
};

export type StatSet = {
  workout_id: string;
  exercise_name: string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_seconds: number | null;
  is_warmup: boolean;
};

/** Geschätztes 1RM nach Epley. null, wenn Gewicht/Wdh. fehlen. */
export function estimatedOneRepMax(
  weight: number | null,
  reps: number | null,
): number | null {
  if (weight == null || reps == null || weight <= 0 || reps <= 0) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Volumen eines Satzes = reps × weight (nur wenn beide vorhanden). */
export function setVolume(set: StatSet): number {
  if (set.reps == null || set.weight_kg == null) return 0;
  return set.reps * set.weight_kg;
}

function workoutDate(workouts: StatWorkout[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of workouts) m.set(w.id, w.performed_on);
  return m;
}

/**
 * Gesamtvolumen (Σ reps×weight) je Trainingstag, aufsteigend nach Datum.
 * Aufwärmsätze zählen mit — reines Trainingsvolumen.
 */
export function volumeBySession(
  workouts: StatWorkout[],
  sets: StatSet[],
): { date: string; volume: number }[] {
  const dateOf = workoutDate(workouts);
  const byDate = new Map<string, number>();
  for (const s of sets) {
    const date = dateOf.get(s.workout_id);
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + setVolume(s));
  }
  return [...byDate.entries()]
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Anzahl Workouts je ISO-Woche (Montag als Wochenstart), aufsteigend.
 * Mehrere Workouts am selben Tag zählen einzeln (echte Trainingseinheiten).
 */
export function frequencyByWeek(
  workouts: StatWorkout[],
): { week: string; count: number }[] {
  const byWeek = new Map<string, number>();
  for (const w of workouts) {
    const week = isoWeekStart(w.performed_on);
    byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  }
  return [...byWeek.entries()]
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/**
 * Progression einer Übung über die Zeit: je Trainingstag das schwerste Gewicht
 * und das beste geschätzte 1RM. Aufwärmsätze werden ignoriert, damit die Kurve
 * die Arbeitssätze zeigt.
 */
export function exerciseProgression(
  workouts: StatWorkout[],
  sets: StatSet[],
  exerciseName: string,
): { date: string; maxWeight: number; estOneRepMax: number }[] {
  const dateOf = workoutDate(workouts);
  const byDate = new Map<string, { maxWeight: number; estOneRepMax: number }>();
  for (const s of sets) {
    if (s.is_warmup) continue;
    if (s.exercise_name !== exerciseName) continue;
    if (s.weight_kg == null) continue;
    const date = dateOf.get(s.workout_id);
    if (!date) continue;
    const e1rm = estimatedOneRepMax(s.weight_kg, s.reps) ?? s.weight_kg;
    const cur = byDate.get(date) ?? { maxWeight: 0, estOneRepMax: 0 };
    byDate.set(date, {
      maxWeight: Math.max(cur.maxWeight, s.weight_kg),
      estOneRepMax: Math.max(cur.estOneRepMax, e1rm),
    });
  }
  return [...byDate.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Beste (schnellste) Zeit je Trainingstag für eine Hyrox-Station, aufsteigend
 * nach Datum. Nur Sätze mit einer Dauer werden berücksichtigt.
 */
export function hyroxStationTimes(
  workouts: StatWorkout[],
  sets: StatSet[],
  stationName: string,
): { date: string; bestSeconds: number }[] {
  const dateOf = workoutDate(workouts);
  const byDate = new Map<string, number>();
  for (const s of sets) {
    if (s.exercise_name !== stationName) continue;
    if (s.duration_seconds == null || s.duration_seconds <= 0) continue;
    const date = dateOf.get(s.workout_id);
    if (!date) continue;
    const cur = byDate.get(date);
    byDate.set(date, cur == null ? s.duration_seconds : Math.min(cur, s.duration_seconds));
  }
  return [...byDate.entries()]
    .map(([date, bestSeconds]) => ({ date, bestSeconds }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type PersonalRecord = {
  exercise_name: string;
  /** Schwerstes je bewegtes Gewicht (kg). */
  maxWeight: number | null;
  /** Bestes geschätztes 1RM (kg). */
  bestEstOneRepMax: number | null;
  /** Meiste Wdh. in einem Satz. */
  maxReps: number | null;
  /** Weiteste Distanz in einem Satz (m). */
  maxDistance: number | null;
  /** Schnellste Zeit in einem Satz (s). */
  bestSeconds: number | null;
};

/**
 * Persönliche Rekorde je Übung, abgeleitet aus allen Sätzen. Arbeitssätze wie
 * Aufwärmsätze zählen mit (ein PR ist ein PR). Alphabetisch nach Übungsname.
 */
export function personalRecords(sets: StatSet[]): PersonalRecord[] {
  const byExercise = new Map<string, PersonalRecord>();
  for (const s of sets) {
    const name = s.exercise_name;
    const rec =
      byExercise.get(name) ??
      ({
        exercise_name: name,
        maxWeight: null,
        bestEstOneRepMax: null,
        maxReps: null,
        maxDistance: null,
        bestSeconds: null,
      } satisfies PersonalRecord);

    if (s.weight_kg != null)
      rec.maxWeight = rec.maxWeight == null ? s.weight_kg : Math.max(rec.maxWeight, s.weight_kg);
    const e1rm = estimatedOneRepMax(s.weight_kg, s.reps);
    if (e1rm != null)
      rec.bestEstOneRepMax =
        rec.bestEstOneRepMax == null ? e1rm : Math.max(rec.bestEstOneRepMax, e1rm);
    if (s.reps != null)
      rec.maxReps = rec.maxReps == null ? s.reps : Math.max(rec.maxReps, s.reps);
    if (s.distance_m != null)
      rec.maxDistance =
        rec.maxDistance == null ? s.distance_m : Math.max(rec.maxDistance, s.distance_m);
    if (s.duration_seconds != null && s.duration_seconds > 0)
      rec.bestSeconds =
        rec.bestSeconds == null ? s.duration_seconds : Math.min(rec.bestSeconds, s.duration_seconds);

    byExercise.set(name, rec);
  }
  return [...byExercise.values()].sort((a, b) =>
    a.exercise_name.localeCompare(b.exercise_name),
  );
}
