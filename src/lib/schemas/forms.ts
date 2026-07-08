import { z } from "zod";
import { TIMES_OF_DAY } from "@/lib/routines/types";
import {
  EXERCISE_CATEGORIES,
  SET_METRICS,
  WORKOUT_MODES,
  WORKOUT_TYPES,
} from "@/lib/workouts/types";

/**
 * Shared zod schemas for the editor forms (TASK-052). Same rules run in the
 * client editors (inline field errors, early feedback) and are exported for the
 * server actions to reuse, so validation lives in exactly one place. Messages are
 * German and terse (Vision § Voice & Tone). Upper bounds guard against runaway
 * input; the empty/required checks trim first like CaptureInputSchema.
 */

const TITLE_MAX = 200;
const BODY_MAX = 5000;
const NOTES_MAX = 2000;
const DESCRIPTION_MAX = 500;

// Optional free text that collapses "" → undefined so empty fields don't fail a
// max-length or format check.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .or(z.literal("").transform(() => undefined));

const requiredName = z
  .string()
  .trim()
  .min(1, "Pflichtfeld.")
  .max(TITLE_MAX, `Höchstens ${TITLE_MAX} Zeichen.`);

export const TaskFormSchema = z.object({
  title: requiredName,
  notes: optionalText(NOTES_MAX),
  recurrence: z.enum(["", "daily", "weekly", "monthly"]).optional(),
});

export const AreaFormSchema = z.object({
  name: requiredName,
});

export const RoutineFormSchema = z.object({
  name: requiredName,
  description: optionalText(DESCRIPTION_MAX),
  time_of_day: z.enum(TIMES_OF_DAY),
  // Positive whole number of days, or empty for an open-ended routine.
  duration_days: z
    .string()
    .regex(/^\d+$/, "Nur ganze Tage.")
    .refine((v) => Number(v) > 0, "Mindestens 1 Tag.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Target check-offs per week (1..7), or empty for a plain daily routine.
  weekly_target: z
    .string()
    .regex(/^\d+$/, "Nur ganze Zahlen.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 7, "1 bis 7 pro Woche.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  // Target check-offs per day (2..20), or empty when not an N-times-per-day routine.
  daily_target: z
    .string()
    .regex(/^\d+$/, "Nur ganze Zahlen.")
    .refine((v) => Number(v) >= 2 && Number(v) <= 20, "2 bis 20 pro Tag.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const JournalFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Schreib oder sprich zuerst etwas.")
    .max(BODY_MAX, `Höchstens ${BODY_MAX} Zeichen.`),
});

// --- Workout-Tracker ---------------------------------------------------------

const EXERCISE_NAME_MAX = 160;

// Ganze Zahl aus einem Formularfeld, oder leer → undefined (wie duration_days).
const optionalPositiveInt = (max: number, label: string) =>
  z
    .string()
    .regex(/^\d+$/, "Nur ganze Zahlen.")
    .refine((v) => Number(v) >= 1 && Number(v) <= max, label)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const ExerciseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Pflichtfeld.")
    .max(EXERCISE_NAME_MAX, `Höchstens ${EXERCISE_NAME_MAX} Zeichen.`),
  category: z.enum(EXERCISE_CATEGORIES),
  metrics: z.array(z.enum(SET_METRICS)).min(1, "Mindestens eine Metrik."),
});

export const WorkoutFormSchema = z.object({
  title: optionalText(TITLE_MAX),
  type: z.enum(WORKOUT_TYPES),
  performed_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt."),
  notes: optionalText(NOTES_MAX),
  perceived_effort: optionalPositiveInt(10, "1 bis 10."),
});

export const TemplateFormSchema = z.object({
  name: requiredName,
  type: z.enum(WORKOUT_TYPES),
  notes: optionalText(NOTES_MAX),
});

// Struktur einer Vorlage (JSONB). Postgres erzwingt die Form nicht, daher hier.
const TemplateSetSchema = z.object({
  exercise_id: z.string().nullable().optional(),
  exercise_name: z.string().trim().min(1).max(EXERCISE_NAME_MAX),
  set_number: z.number().int().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  weight_kg: z.number().nullable().optional(),
  distance_m: z.number().int().nullable().optional(),
  duration_seconds: z.number().int().nullable().optional(),
  calories: z.number().int().nullable().optional(),
});

const TemplateBlockSchema = z.object({
  mode: z.enum(WORKOUT_MODES),
  name: z.string().nullable().optional(),
  duration_seconds: z.number().int().nullable().optional(),
  interval_seconds: z.number().int().nullable().optional(),
  rest_seconds: z.number().int().nullable().optional(),
  rounds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  sets: z.array(TemplateSetSchema),
});

export const TemplateStructureSchema = z.array(TemplateBlockSchema);

/**
 * Run a schema and return a flat `{ field: message }` map of the first error per
 * field, or null when valid — the shape the editors render inline.
 */
export function fieldErrors<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): Record<string, string> | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
