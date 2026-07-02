-- Atlas — Supabase Cron scheduler (replaces GitHub Actions cron, TASK-042/043/044).
-- GitHub scheduled workflows were unreliable (delayed / skipped under load), so the
-- reminder / calendar-sync / daily-summary routes are now driven by pg_cron + pg_net
-- straight from the database. Plan-independent (works on Vercel Hobby) and reliable.
--
-- The API routes and src/lib/cron/auth.ts are UNCHANGED — only the trigger moved.
-- Fully idempotent: unschedules any prior job before re-creating it.
--
-- Requires two Vault secrets (create once in the dashboard, never committed):
--   atlas_cron_base_url  -> stable PROD origin, e.g. https://atlas.vercel.app
--   atlas_cron_secret    -> identical to the Vercel env CRON_SECRET
--
-- pg_cron runs in UTC on Supabase, so '0 5 * * *' stays 05:00 UTC as before.
-- All objects are schema-qualified (net./vault./cron.) since cron jobs run without
-- an extended search_path.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- --- Idempotency: drop prior jobs (ignore "does not exist") -------------------
do $$
begin
  perform cron.unschedule('atlas-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('atlas-calendar-sync');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('atlas-daily-summary');
exception when others then null;
end $$;

-- --- Reminders: every 15 minutes ---------------------------------------------
select cron.schedule('atlas-reminders', '*/15 * * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/reminders',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- --- Calendar sync: every 15 minutes -----------------------------------------
-- Higher timeout: this route makes several Google API calls per user.
select cron.schedule('atlas-calendar-sync', '*/15 * * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/calendar-sync',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- --- Daily summary: 05:00 UTC (~06:00-07:00 Europe/Berlin) -------------------
select cron.schedule('atlas-daily-summary', '0 5 * * *', $$
  select net.http_get(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_base_url') || '/api/cron/daily-summary',
    headers := jsonb_build_object('Authorization',
                 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'atlas_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
