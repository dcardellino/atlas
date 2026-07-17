/**
 * Journal-reminder defaults — the single source of truth for "reminders on by
 * default". Kept in its own side-effect-free module so it can be shared between
 * the `"use server"` settings actions (reminder-settings.ts) and the
 * `server-only` cron core (reminder-cron.ts) without either pulling the other's
 * bundle in.
 *
 * These defaults are effective, not just cosmetic: the cron applies them to any
 * user who owns data but has never saved a settings row, so a fresh user gets
 * morning/evening pushes without having to visit Settings first.
 */

export type ReminderSettings = {
  morning_enabled: boolean;
  morning_time: string;
  evening_enabled: boolean;
  evening_time: string;
};

export const DEFAULTS: ReminderSettings = {
  morning_enabled: true,
  morning_time: "07:00",
  evening_enabled: true,
  evening_time: "21:00",
};
