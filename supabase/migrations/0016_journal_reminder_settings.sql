-- Atlas — Journal-Reminder-Settings (configurable morning/evening journal pushes).
-- One row per user: enabled + time for both reminders, plus *_last_sent_on as a
-- dedup marker (same role as tasks.reminder_sent_at from 0006, just day-grained
-- since this can fire at most once per day per threshold). Style mirrors
-- 0014_workouts.sql; cron wiring mirrors 0009_supabase_cron.sql.

create table if not exists journal_reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  morning_enabled boolean not null default true,
  morning_time time not null default '07:00',
  morning_last_sent_on date,
  evening_enabled boolean not null default true,
  evening_time time not null default '21:00',
  evening_last_sent_on date,
  updated_at timestamptz not null default now()
);

alter table journal_reminder_settings enable row level security;
drop policy if exists "journal_reminder_settings_select" on journal_reminder_settings;
create policy "journal_reminder_settings_select" on journal_reminder_settings for select using (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_insert" on journal_reminder_settings;
create policy "journal_reminder_settings_insert" on journal_reminder_settings for insert with check (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_update" on journal_reminder_settings;
create policy "journal_reminder_settings_update" on journal_reminder_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "journal_reminder_settings_delete" on journal_reminder_settings;
create policy "journal_reminder_settings_delete" on journal_reminder_settings for delete using (auth.uid() = user_id);

-- --- pg_cron: new route, every 15 minutes (mirrors 0009_supabase_cron.sql) ---
do $$
begin
  perform cron.unschedule('atlas-journal-reminders');
exception when others then null;
end $$;

select cron.schedule('atlas-journal-reminders', '*/15 * * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/journal-reminders',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

notify pgrst, 'reload schema';
