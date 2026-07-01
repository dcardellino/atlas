/**
 * Journal media constants (TASK-038/039). Shared by both server (actions/media)
 * and client (upload/composer) — so this module must stay free of any
 * server-only imports.
 */

export const JOURNAL_BUCKET = "journal-media";

// Client-side ceiling after compression. Oversized photos are rejected with a
// hint (Edge Case: "Zu großes Foto → client-seitig komprimieren/ablehnen").
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Longest edge we downscale to before re-encoding (keeps uploads light).
export const MAX_IMAGE_DIMENSION = 1600;

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;
