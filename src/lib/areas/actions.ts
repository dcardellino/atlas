"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uniqueSlug } from "@/lib/areas/slug";

/**
 * Areas data access (TASK-026, FR-005). Server actions under the session client
 * (RLS). Manual ordering via `sort_order`; deleting an area sets the FKs of its
 * tasks/routines/journal entries to NULL (DB `ON DELETE SET NULL`) so entries
 * survive and become "heimatlos" — reattachable via OrphanReassign (TASK-028).
 *
 * Note: the `areas` table has no `updated_at` column, so updates never set one.
 */

export type Area = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
  last_activity_at: string | null;
  created_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function list(): Promise<Area[]> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("areas")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as Area[]) ?? [];
}

export async function create(input: {
  name: string;
  color?: string | null;
  icon?: string | null;
}): Promise<Area> {
  const { supabase, userId } = await requireUser();

  // Compute a unique slug and the next sort position from existing areas.
  const { data: existing } = await supabase
    .from("areas")
    .select("slug, sort_order")
    .eq("user_id", userId);
  const taken = new Set((existing ?? []).map((a) => a.slug as string));
  const maxOrder = (existing ?? []).reduce(
    (m, a) => Math.max(m, (a.sort_order as number) ?? 0),
    -1,
  );

  const { data, error } = await supabase
    .from("areas")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      slug: uniqueSlug(input.name, taken),
      color: input.color ?? null,
      icon: input.icon ?? null,
      sort_order: maxOrder + 1,
    })
    .select("*")
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "could not create area");
  revalidatePath("/areas");
  revalidatePath("/today");
  return data as Area;
}

export async function update(
  id: string,
  patch: Partial<Pick<Area, "name" | "color" | "icon">>,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("areas").update(patch).eq("id", id).eq("user_id", userId);
  revalidatePath("/areas");
  revalidatePath("/today");
}

/** Persist a new manual ordering. `orderedIds` is the full list, front to back. */
export async function reorder(orderedIds: string[]): Promise<void> {
  const { supabase, userId } = await requireUser();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("areas")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );
  revalidatePath("/areas");
  revalidatePath("/today");
}

/**
 * Delete an area. Its tasks/routines/journal entries are NOT deleted — their
 * `area_id` is set to NULL by the DB FK (`ON DELETE SET NULL`), leaving them
 * orphaned for reassignment.
 */
export async function remove(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("areas").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/areas");
  revalidatePath("/tasks");
  revalidatePath("/routines");
  revalidatePath("/today");
}

export type Orphan = {
  id: string;
  kind: "task" | "routine";
  title: string;
};

/** Tasks and routines with no area (`area_id IS NULL`) — for OrphanReassign. */
export async function listOrphans(): Promise<Orphan[]> {
  const { supabase, userId } = await requireUser();
  const [tasksRes, routinesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title")
      .eq("user_id", userId)
      .is("area_id", null)
      .eq("status", "open"),
    supabase
      .from("routines")
      .select("id, name")
      .eq("user_id", userId)
      .is("area_id", null)
      .is("archived_at", null),
  ]);
  const tasks: Orphan[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id as string,
    kind: "task" as const,
    title: t.title as string,
  }));
  const routines: Orphan[] = (routinesRes.data ?? []).map((r) => ({
    id: r.id as string,
    kind: "routine" as const,
    title: r.name as string,
  }));
  return [...tasks, ...routines];
}

/** Reattach an orphaned task or routine to an area. */
export async function reassignOrphan(
  kind: "task" | "routine",
  id: string,
  areaId: string,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  const table = kind === "task" ? "tasks" : "routines";
  await supabase
    .from(table)
    .update({ area_id: areaId })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/areas");
  revalidatePath("/tasks");
  revalidatePath("/routines");
  revalidatePath("/today");
}
