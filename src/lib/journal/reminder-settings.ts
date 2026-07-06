"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Journal reminder settings — one row per user, read/written under the session
 * client (RLS). Powers the Settings UI. The cron route reads the same table
 * through the admin client instead (see reminder-cron.ts), so it isn't scoped
 * to a logged-in session.
 */

export type ReminderSettings = {
  morning_enabled: boolean;
  morning_time: string;
  evening_enabled: boolean;
  evening_time: string;
};

const DEFAULTS: ReminderSettings = {
  morning_enabled: true,
  morning_time: "07:00",
  evening_enabled: true,
  evening_time: "21:00",
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("journal_reminder_settings")
    .select("morning_enabled, morning_time, evening_enabled, evening_time")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return DEFAULTS;
  return {
    morning_enabled: data.morning_enabled as boolean,
    morning_time: (data.morning_time as string).slice(0, 5),
    evening_enabled: data.evening_enabled as boolean,
    evening_time: (data.evening_time as string).slice(0, 5),
  };
}

export async function updateReminderSettings(
  patch: Partial<ReminderSettings>,
): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("journal_reminder_settings").upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  revalidatePath("/settings");
}
