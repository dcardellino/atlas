import { createClient } from "@/lib/supabase/server";
import { JOURNAL_BUCKET } from "./constants";

/**
 * Journal media — server-side signed-URL resolution (TASK-038, FR-008).
 *
 * Photos live in the private `journal-media` bucket (0005_journal_storage.sql),
 * owner-scoped by the first path segment. They are never public; display always
 * goes through short-lived signed URLs minted here under the session client.
 * The upload itself happens client-side (see the Journal composer) so an upload
 * failure can never block the text entry.
 */

const DEFAULT_TTL = 60 * 60; // 1h — long enough for a feed render.

/** Map bucket paths → signed URLs (one round-trip). Missing paths are omitted. */
export async function signedUrlMap(
  paths: string[],
  expiresIn: number = DEFAULT_TTL,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(JOURNAL_BUCKET)
    .createSignedUrls(paths, expiresIn);

  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}
