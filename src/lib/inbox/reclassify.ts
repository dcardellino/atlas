"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClassificationType } from "@/lib/schemas/capture";

/**
 * Reclassification / correction (TASK-053, FR-012). Moves a captured item that
 * the AI filed wrong into another type and/or area. It deletes the old target
 * row, creates the new-type row from the original raw text, and records the
 * override on the originating inbox_item (`corrected_*`) so the correction is
 * both auditable and countable for the AI-correction-rate metric (TASK-057).
 *
 * Runs under the session client (RLS): every read/write is scoped to the signed-
 * in user, and inserts carry an explicit user_id matching auth.uid().
 */

const TABLE_BY_TYPE: Record<Exclude<ClassificationType, "note">, string> = {
  task: "tasks",
  routine: "routines",
  journal: "journal_entries",
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function reclassify(input: {
  inboxId: string;
  toType: ClassificationType;
  areaId?: string | null;
}): Promise<void> {
  const { supabase, userId } = await requireUser();
  const areaId = input.areaId ?? null;

  // 1. Load the originating capture (RLS scopes this to the current user).
  const { data: inbox, error: inboxError } = await supabase
    .from("inbox_items")
    .select("id, raw_text, source, classified_type, classified_into")
    .eq("id", input.inboxId)
    .single();
  if (inboxError || !inbox) throw new Error("inbox item not found");

  const oldType = inbox.classified_type as ClassificationType | null;

  // 2. Remove the previous target row (unless it was a plain note, which lives
  //    on the inbox item itself — nothing separate to delete).
  if (
    oldType &&
    oldType !== "note" &&
    inbox.classified_into &&
    inbox.classified_into !== inbox.id
  ) {
    await supabase
      .from(TABLE_BY_TYPE[oldType])
      .delete()
      .eq("id", inbox.classified_into)
      .eq("user_id", userId);
  }

  // 3. Create the new target row (note → none; the inbox item is the note).
  let createdId = inbox.id;
  if (input.toType === "task") {
    const { data } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        area_id: areaId,
        title: inbox.raw_text,
        source_inbox_id: inbox.id,
      })
      .select("id")
      .single();
    if (data) createdId = data.id;
  } else if (input.toType === "routine") {
    const { data } = await supabase
      .from("routines")
      .insert({ user_id: userId, area_id: areaId, name: inbox.raw_text })
      .select("id")
      .single();
    if (data) createdId = data.id;
  } else if (input.toType === "journal") {
    const { data } = await supabase
      .from("journal_entries")
      .insert({
        user_id: userId,
        area_id: areaId,
        body: inbox.raw_text,
        source: inbox.source,
        source_inbox_id: inbox.id,
      })
      .select("id")
      .single();
    if (data) createdId = data.id;
  }

  // 4. Stamp the correction on the inbox item (audit + metrics source).
  await supabase
    .from("inbox_items")
    .update({
      status: "classified",
      classified_type: input.toType,
      classified_into: createdId,
      corrected_type: input.toType,
      corrected_area_id: areaId,
      corrected_at: new Date().toISOString(),
    })
    .eq("id", inbox.id)
    .eq("user_id", userId);

  // Refresh every surface that could show the moved item.
  for (const path of ["/today", "/tasks", "/routines", "/journal"]) {
    revalidatePath(path);
  }
}
