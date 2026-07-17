"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULTS, type ReminderSettings } from "./reminder-defaults";

/**
 * Journal reminder settings — one row per user, read/written under the session
 * client (RLS). Powers the Settings UI. The cron route reads the same table
 * through the admin client instead (see reminder-cron.ts), so it isn't scoped
 * to a logged-in session. Defaults live in reminder-defaults.ts, shared with the
 * cron so the "on by default" the UI shows is exactly what the cron sends.
 */

export type { ReminderSettings };

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
  revalidatePath("/settings/reminders");
}
