import { createClient } from "@/lib/supabase/client";
import {
  JOURNAL_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
} from "./constants";

/**
 * Client-side journal photo upload (TASK-039, FR-008). Runs in the browser: it
 * compresses the image, then uploads directly to the private bucket under the
 * owner's path (`<userId>/<entryId>/<uuid>.jpg`), matching the Storage RLS from
 * 0005. Kept off the server action path so a failure only skips the photo — the
 * text entry is already saved (Edge Case: Foto-Upload-Fehler ≠ Datenverlust).
 */

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Downscale to the longest edge and re-encode as JPEG to keep uploads light. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // undecodable → the size check below still guards
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  return blob ?? file;
}

/**
 * Compress + upload one photo, returning its bucket-relative storage path.
 * Throws {@link UploadError} with a user-facing German message on failure.
 */
export async function uploadJournalPhoto(
  userId: string,
  entryId: string,
  file: File,
): Promise<string> {
  const blob = await compressImage(file);
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new UploadError("Foto ist zu groß — bitte ein kleineres wählen.");
  }
  const supabase = createClient();
  const path = `${userId}/${entryId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(JOURNAL_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) {
    throw new UploadError("Foto konnte nicht hochgeladen werden.");
  }
  return path;
}
