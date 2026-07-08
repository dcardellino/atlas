import { z } from "zod";

/**
 * Zod schema for the capture pipeline (TASK-012).
 *
 * `CaptureInput` validates what reaches POST /api/capture (from the iOS
 * shortcut or the PWA quick-capture overlay).
 */

export const CAPTURE_SOURCES = ["ios_shortcut", "pwa_voice", "pwa_text"] as const;

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

export type CaptureInput = z.infer<typeof CaptureInputSchema>;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];
