"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  BlockInput,
  BlockWithSets,
  Exercise,
  ExerciseCategory,
  SetInput,
  SetMetric,
  Workout,
  WorkoutBlock,
  WorkoutDetail,
  WorkoutInput,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutType,
} from "@/lib/workouts/types";

/**
 * Workout-Tracker Datenzugriff. Server Actions unter dem Session-Client (RLS).
 *
 * Ein Workout wird verschachtelt gespeichert (workout → blocks → sets). Supabase
 * JS kann das nicht in einer Transaktion bündeln, daher: (1) Workout einfügen,
 * (2) alle Blöcke in einem Array-Insert, (3) Block-ids in alle Sätze mappen und
 * ein Array-Insert. Schlägt ein Schritt fehl, wird die Workout-Zeile gelöscht —
 * ON DELETE CASCADE räumt bereits geschriebene Blöcke/Sätze auf. Editieren löscht
 * die Kinder und fügt sie aus dem Payload neu ein. Alle Mutationen sind doppelt
 * gescoped (.eq("id").eq("user_id")) als Defense-in-Depth neben RLS.
 *
 * Typen und Konstanten liegen in ./types (ein "use server"-Modul darf nur async
 * Funktionen exportieren).
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** Die „Fitness"-Area des Nutzers (Standard-Zuordnung für Workouts), oder null. */
async function resolveFitnessAreaId(
  supabase: Supabase,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("areas")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "fitness")
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

// --- Exercises ---------------------------------------------------------------

export async function listExercises(): Promise<Exercise[]> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  return (data as Exercise[]) ?? [];
}

export async function createExercise(input: {
  name: string;
  category: ExerciseCategory;
  metrics: SetMetric[];
}): Promise<Exercise> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("exercises")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      category: input.category,
      metrics: input.metrics,
      is_default: false,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "could not create exercise");
  revalidatePath("/workouts/exercises");
  revalidatePath("/workouts/new");
  return data as Exercise;
}

export async function updateExercise(
  id: string,
  patch: Partial<Pick<Exercise, "name" | "category" | "metrics">>,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("exercises")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/workouts/exercises");
}

/** Übung archivieren (nicht löschen) — bestehende Set-Historie bleibt erhalten. */
export async function archiveExercise(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/workouts/exercises");
}

// --- Workouts ----------------------------------------------------------------

export async function listWorkouts(): Promise<Workout[]> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .order("performed_on", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as Workout[]) ?? [];
}

export async function getWorkout(id: string): Promise<WorkoutDetail | null> {
  const { supabase, userId } = await requireUser();
  const { data: workout } = await supabase
    .from("workouts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!workout) return null;

  const [blocksRes, setsRes] = await Promise.all([
    supabase
      .from("workout_blocks")
      .select("*")
      .eq("workout_id", id)
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    supabase
      .from("workout_sets")
      .select("*")
      .eq("workout_id", id)
      .eq("user_id", userId)
      .order("position", { ascending: true }),
  ]);

  const setsByBlock = new Map<string, WorkoutSet[]>();
  for (const s of (setsRes.data as WorkoutSet[]) ?? []) {
    const arr = setsByBlock.get(s.block_id) ?? [];
    arr.push(s);
    setsByBlock.set(s.block_id, arr);
  }
  const blocks: BlockWithSets[] = ((blocksRes.data as WorkoutBlock[]) ?? []).map(
    (b) => ({ ...b, sets: setsByBlock.get(b.id) ?? [] }),
  );
  return { ...(workout as Workout), blocks };
}

/**
 * Blöcke + Sätze eines bereits angelegten Workouts einfügen. Wirft bei Fehlern,
 * damit der Aufrufer die Workout-Zeile aufräumen kann (Cascade entfernt Reste).
 */
async function insertBlocksAndSets(
  supabase: Supabase,
  userId: string,
  workoutId: string,
  blocks: BlockInput[],
): Promise<void> {
  if (blocks.length === 0) return;

  const blockRows = blocks.map((b, i) => ({
    user_id: userId,
    workout_id: workoutId,
    mode: b.mode,
    name: b.name ?? null,
    position: i,
    duration_seconds: b.duration_seconds ?? null,
    interval_seconds: b.interval_seconds ?? null,
    rest_seconds: b.rest_seconds ?? null,
    rounds: b.rounds ?? null,
    result_rounds: b.result_rounds ?? null,
    result_reps: b.result_reps ?? null,
    result_seconds: b.result_seconds ?? null,
    notes: b.notes ?? null,
  }));

  const { data: insertedBlocks, error: blocksError } = await supabase
    .from("workout_blocks")
    .insert(blockRows)
    .select("id, position");
  if (blocksError || !insertedBlocks)
    throw new Error(blocksError?.message ?? "could not insert blocks");

  // position → block id (Array-Insert bewahrt die Reihenfolge nicht garantiert,
  // daher über die eindeutige position mappen).
  const idByPosition = new Map<number, string>();
  for (const b of insertedBlocks as { id: string; position: number }[]) {
    idByPosition.set(b.position, b.id);
  }

  const setRows: Record<string, unknown>[] = [];
  blocks.forEach((b, blockIndex) => {
    const blockId = idByPosition.get(blockIndex);
    if (!blockId) return;
    b.sets.forEach((s: SetInput, setIndex) => {
      setRows.push({
        user_id: userId,
        workout_id: workoutId,
        block_id: blockId,
        exercise_id: s.exercise_id ?? null,
        exercise_name: s.exercise_name.trim(),
        position: setIndex,
        set_number: s.set_number ?? setIndex + 1,
        reps: s.reps ?? null,
        weight_kg: s.weight_kg ?? null,
        distance_m: s.distance_m ?? null,
        duration_seconds: s.duration_seconds ?? null,
        calories: s.calories ?? null,
        rpe: s.rpe ?? null,
      });
    });
  });

  if (setRows.length > 0) {
    const { error: setsError } = await supabase
      .from("workout_sets")
      .insert(setRows);
    if (setsError) throw new Error(setsError.message);
  }
}

export async function createWorkout(input: WorkoutInput): Promise<Workout> {
  const { supabase, userId } = await requireUser();
  const areaId =
    input.area_id ?? (await resolveFitnessAreaId(supabase, userId));

  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      area_id: areaId,
      title: input.title?.trim() || null,
      type: input.type,
      performed_on: input.performed_on,
      notes: input.notes ?? null,
      perceived_effort: input.perceived_effort ?? null,
      total_duration_seconds: input.total_duration_seconds ?? null,
      template_id: input.template_id ?? null,
    })
    .select("*")
    .single();
  if (error || !workout)
    throw new Error(error?.message ?? "could not create workout");

  try {
    await insertBlocksAndSets(
      supabase,
      userId,
      (workout as Workout).id,
      input.blocks,
    );
  } catch (e) {
    // Teil-Write aufräumen: Cascade entfernt eingefügte Blöcke/Sätze.
    await supabase
      .from("workouts")
      .delete()
      .eq("id", (workout as Workout).id)
      .eq("user_id", userId);
    throw e;
  }

  revalidatePath("/workouts");
  revalidatePath("/today");
  return workout as Workout;
}

export async function updateWorkout(
  id: string,
  input: WorkoutInput,
): Promise<void> {
  const { supabase, userId } = await requireUser();

  await supabase
    .from("workouts")
    .update({
      title: input.title?.trim() || null,
      type: input.type,
      performed_on: input.performed_on,
      notes: input.notes ?? null,
      perceived_effort: input.perceived_effort ?? null,
      total_duration_seconds: input.total_duration_seconds ?? null,
      area_id: input.area_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  // Kinder ersetzen: Blöcke löschen (Cascade entfernt Sätze), dann neu einfügen.
  await supabase
    .from("workout_blocks")
    .delete()
    .eq("workout_id", id)
    .eq("user_id", userId);
  await insertBlocksAndSets(supabase, userId, id, input.blocks);

  revalidatePath("/workouts");
  revalidatePath(`/workouts/${id}`);
  revalidatePath("/today");
}

export async function removeWorkout(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("workouts").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/workouts");
  revalidatePath("/today");
}

// --- Templates ---------------------------------------------------------------

export async function listTemplates(): Promise<WorkoutTemplate[]> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as WorkoutTemplate[]) ?? [];
}

export async function createTemplate(input: {
  name: string;
  type: WorkoutType;
  structure: WorkoutTemplate["structure"];
  notes?: string | null;
}): Promise<WorkoutTemplate> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("workout_templates")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      type: input.type,
      structure: input.structure,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "could not create template");
  revalidatePath("/workouts/templates");
  return data as WorkoutTemplate;
}

export async function updateTemplate(
  id: string,
  patch: Partial<
    Pick<WorkoutTemplate, "name" | "type" | "structure" | "notes">
  >,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("workout_templates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/workouts/templates");
}

export async function removeTemplate(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("workout_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/workouts/templates");
}

/**
 * Aus einer Vorlage ein echtes Workout anlegen. Die Struktur trägt Modus/Config
 * und Ziel-Vorgaben, aber KEINE Ergebnisse — die Ergebnis-Spalten bleiben null
 * und werden nach dem Training vom Nutzer gefüllt. Gibt die neue Workout-id zurück.
 */
export async function instantiateTemplate(
  templateId: string,
  performedOn: string,
): Promise<string> {
  const { supabase, userId } = await requireUser();
  const { data: template } = await supabase
    .from("workout_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();
  if (!template) throw new Error("template not found");

  const t = template as WorkoutTemplate;
  const blocks: BlockInput[] = (t.structure ?? []).map((b) => ({
    mode: b.mode,
    name: b.name ?? null,
    duration_seconds: b.duration_seconds ?? null,
    interval_seconds: b.interval_seconds ?? null,
    rest_seconds: b.rest_seconds ?? null,
    rounds: b.rounds ?? null,
    notes: b.notes ?? null,
    // Ergebnisse bewusst weglassen (null) — werden nach dem Workout gefüllt.
    sets: (b.sets ?? []).map((s) => ({
      exercise_id: s.exercise_id ?? null,
      exercise_name: s.exercise_name,
      set_number: s.set_number ?? null,
      reps: s.reps ?? null,
      weight_kg: s.weight_kg ?? null,
      distance_m: s.distance_m ?? null,
      duration_seconds: s.duration_seconds ?? null,
      calories: s.calories ?? null,
    })),
  }));

  const workout = await createWorkout({
    title: t.name,
    type: t.type,
    performed_on: performedOn,
    template_id: t.id,
    blocks,
  });
  return workout.id;
}

// --- Statistik-Daten ---------------------------------------------------------

/** Alle Workouts + Sätze des Nutzers für die reine Statistik-Berechnung (stats.ts). */
export async function loadStatsData(): Promise<{
  workouts: { id: string; performed_on: string; type: string }[];
  sets: {
    workout_id: string;
    exercise_name: string;
    reps: number | null;
    weight_kg: number | null;
    distance_m: number | null;
    duration_seconds: number | null;
  }[];
}> {
  const { supabase, userId } = await requireUser();
  const [workoutsRes, setsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, performed_on, type")
      .eq("user_id", userId),
    supabase
      .from("workout_sets")
      .select(
        "workout_id, exercise_name, reps, weight_kg, distance_m, duration_seconds",
      )
      .eq("user_id", userId),
  ]);
  return {
    workouts: (workoutsRes.data as {
      id: string;
      performed_on: string;
      type: string;
    }[]) ?? [],
    sets: (setsRes.data as {
      workout_id: string;
      exercise_name: string;
      reps: number | null;
      weight_kg: number | null;
      distance_m: number | null;
      duration_seconds: number | null;
    }[]) ?? [],
  };
}
