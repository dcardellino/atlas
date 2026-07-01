"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { JOURNAL_BUCKET } from "./constants";
import { signedUrlMap } from "./media";
import type { JournalEntry, JournalFeedItem, JournalMedia } from "./types";

/**
 * Journal data access (TASK-037, FR-008). Server actions under the session
 * client (RLS). The write path is split so a failed photo upload can never lose
 * the text entry (Edge Case: "Foto-Upload schlägt fehl → Texteintrag wird
 * trotzdem gespeichert"): `create` persists the entry first, the client then
 * uploads photos to Storage, and `attachMedia` records them afterwards.
 *
 * Types live in ./types (a Server Actions module may only export async funcs).
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

/** The reflection feed, newest first, with resolved media signed URLs. */
export async function listFeed(): Promise<JournalFeedItem[]> {
  const { supabase, userId } = await requireUser();

  const [entriesRes, areasRes] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("id, area_id, body, entry_date, source, created_at")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("areas").select("id, name").eq("user_id", userId),
  ]);

  const entries = (entriesRes.data as JournalEntry[]) ?? [];
  const areaName = new Map(
    (areasRes.data ?? []).map((a) => [a.id as string, a.name as string]),
  );

  const entryIds = entries.map((e) => e.id);
  const mediaRes = entryIds.length
    ? await supabase
        .from("journal_media")
        .select("id, journal_entry_id, storage_path, media_type, created_at")
        .eq("user_id", userId)
        .in("journal_entry_id", entryIds)
        .order("created_at", { ascending: true })
    : { data: [] as JournalMedia[] };

  const media = (mediaRes.data as JournalMedia[]) ?? [];
  const urls = await signedUrlMap(media.map((m) => m.storage_path));

  const byEntry = new Map<string, JournalFeedItem["media"]>();
  for (const m of media) {
    const arr = byEntry.get(m.journal_entry_id) ?? [];
    arr.push({
      id: m.id,
      url: urls.get(m.storage_path) ?? null,
      media_type: m.media_type,
    });
    byEntry.set(m.journal_entry_id, arr);
  }

  return entries.map((e) => ({
    ...e,
    area_name: e.area_id ? (areaName.get(e.area_id) ?? null) : null,
    media: byEntry.get(e.id) ?? [],
  }));
}

/** Persist a text (or voice-transcribed) entry. Photos are attached separately. */
export async function create(input: {
  body: string;
  area_id?: string | null;
  source?: string;
}): Promise<JournalEntry> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      body: input.body.trim(),
      area_id: input.area_id ?? null,
      source: input.source ?? "pwa_text",
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "could not create journal entry");
  revalidatePath("/journal");
  revalidatePath("/today");
  return data as JournalEntry;
}

/**
 * Record photos the client already uploaded to Storage. Kept separate from
 * `create` so an upload failure only skips this step — the text entry survives.
 */
export async function attachMedia(
  journalEntryId: string,
  items: { storage_path: string; media_type?: string }[],
): Promise<void> {
  if (items.length === 0) return;
  const { supabase, userId } = await requireUser();
  await supabase.from("journal_media").insert(
    items.map((i) => ({
      user_id: userId,
      journal_entry_id: journalEntryId,
      storage_path: i.storage_path,
      media_type: i.media_type ?? "image",
    })),
  );
  revalidatePath("/journal");
}

/** Delete an entry and its photos (rows cascade; Storage objects removed here). */
export async function remove(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();

  const { data: media } = await supabase
    .from("journal_media")
    .select("storage_path")
    .eq("user_id", userId)
    .eq("journal_entry_id", id);
  const paths = (media ?? []).map((m) => m.storage_path as string);
  if (paths.length > 0) {
    await supabase.storage.from(JOURNAL_BUCKET).remove(paths);
  }

  await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/journal");
  revalidatePath("/today");
}
