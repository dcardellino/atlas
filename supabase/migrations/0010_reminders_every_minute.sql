-- Atlas — Reminder cron cadence: every 15 min -> every minute (follow-up to 0009).
-- With the 15-min poll a reminder set for e.g. 09:57 only fired at the 10:00 tick
-- (up to ~15 min late). Reminders should go out close to their `reminder_at`, so
-- poll every minute (≤1 min delay). The route is cheap (one indexed query; Telegram
-- only when actually due), so 1440 runs/day is negligible. Calendar-sync (Google
-- API, heavier) and daily-summary stay unchanged.
--
-- Re-scheduling the same job name replaces the existing job — idempotent.

select cron.schedule('atlas-reminders', '* * * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
