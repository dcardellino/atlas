"use server";

import { revalidatePath } from "next/cache";
import { addDays, addWeeks, addMonths } from "date-fns";
import { createClient } from "@/lib/supabase/server";

/**
 * Tasks data access (TASK-018, FR-004). Server actions under the session client
 * (RLS). Recurring tasks spawn their next instance on completion.
 */

export type Task = {
  id: string;
  area_id: string | null;
  title: string;
  notes: string | null;
  due_at: string | null;
  reminder_at: string | null;
  is_top3: boolean;
  status: "open" | "done";
  completed_at: string | null;
  recurrence: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFilter = {
  status?: "open" | "done" | "all";
  areaId?: string | null;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function list(filter: TaskFilter = {}): Promise<Task[]> {
  const { supabase, userId } = await requireUser();
  let query = supabase.from("tasks").select("*").eq("user_id", userId);

  if (!filter.status || filter.status === "open") {
    query = query.eq("status", "open");
  } else if (filter.status === "done") {
    query = query.eq("status", "done");
  }
  if (filter.areaId) query = query.eq("area_id", filter.areaId);

  // Due first (nulls last), then most recent.
  const { data } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data as Task[]) ?? [];
}

export async function create(input: {
  title: string;
  notes?: string | null;
  due_at?: string | null;
  reminder_at?: string | null;
  area_id?: string | null;
  recurrence?: string | null;
}): Promise<Task> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      notes: input.notes ?? null,
      due_at: input.due_at ?? null,
      reminder_at: input.reminder_at ?? null,
      area_id: input.area_id ?? null,
      recurrence: input.recurrence ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "could not create task");
  revalidatePath("/tasks");
  revalidatePath("/today");
  return data as Task;
}

export async function update(
  id: string,
  patch: Partial<
    Pick<
      Task,
      | "title"
      | "notes"
      | "due_at"
      | "reminder_at"
      | "area_id"
      | "recurrence"
      | "is_top3"
    >
  >,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("tasks")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}

/** Advance a due date by the recurrence cadence; null if no due date. */
function nextDueAt(due_at: string | null, recurrence: string): string | null {
  if (!due_at) return null;
  const base = new Date(due_at);
  switch (recurrence) {
    case "daily":
      return addDays(base, 1).toISOString();
    case "weekly":
      return addWeeks(base, 1).toISOString();
    case "monthly":
      return addMonths(base, 1).toISOString();
    default:
      return null;
  }
}

/**
 * Toggle completion. Completing a recurring task also creates its next instance
 * (PRD § US-004 edge case).
 */
export async function toggleComplete(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!task) return;

  const completing = (task as Task).status === "open";
  await supabase
    .from("tasks")
    .update({
      status: completing ? "done" : "open",
      completed_at: completing ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (completing && (task as Task).recurrence) {
    const t = task as Task;
    await supabase.from("tasks").insert({
      user_id: userId,
      area_id: t.area_id,
      title: t.title,
      notes: t.notes,
      due_at: nextDueAt(t.due_at, t.recurrence!),
      reminder_at: t.reminder_at,
      recurrence: t.recurrence,
    });
  }

  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function setTop3(id: string, isTop3: boolean): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("tasks")
    .update({ is_top3: isTop3, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function remove(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/tasks");
  revalidatePath("/today");
}
