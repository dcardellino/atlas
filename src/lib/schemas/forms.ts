import { z } from "zod";
import { TIMES_OF_DAY } from "@/lib/routines/types";

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
