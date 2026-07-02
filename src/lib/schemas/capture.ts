import { z } from "zod";

/**
 * Zod schemas for the capture pipeline (TASK-012).
 *
 * `CaptureInput` validates what reaches POST /api/capture (from the iOS
 * shortcut or the PWA quick-capture overlay). `Classification` validates the
 * AI's structured answer before anything is written to the DB — the Anthropic
 * output is never trusted unparsed (PRD § Security: "nie ungeprüft in DB
 * schreiben").
 */

export const CAPTURE_SOURCES = ["ios_shortcut", "pwa_voice", "pwa_text"] as const;
export const CLASSIFICATION_TYPES = [
  "task",
  "note",
  "journal",
  "routine",
] as const;

// Upper bound on a single capture. Generous for a spoken paragraph, but caps
// large-payload abuse before anything is persisted or sent to the model (TASK-056).
export const CAPTURE_TEXT_MAX = 5000;

export const CaptureInputSchema = z.object({
  // Trim first, then require at least one non-whitespace character so an empty
  // or whitespace-only dictation is rejected with a 400 (Edge Cases: "Ungültiges/
  // leeres Diktat"), and cap the length to guard against oversized payloads.
  text: z
    .string()
    .trim()
    .min(1, "text must not be empty")
    .max(CAPTURE_TEXT_MAX, "text too long"),
  source: z.enum(CAPTURE_SOURCES),
});

export const ClassificationSchema = z.object({
  type: z.enum(CLASSIFICATION_TYPES),
  title: z.string().trim().min(1),
  // Absolute ISO-8601 instant resolved by the model in the user timezone, or
  // null when the capture carries no due date.
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  // Slug of an existing area, or null/omitted → "unzugeordnet" (FR-002).
  area_slug: z.string().trim().min(1).nullable().optional(),
});

export type CaptureInput = z.infer<typeof CaptureInputSchema>;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];
export type Classification = z.infer<typeof ClassificationSchema>;
export type ClassificationType = (typeof CLASSIFICATION_TYPES)[number];
