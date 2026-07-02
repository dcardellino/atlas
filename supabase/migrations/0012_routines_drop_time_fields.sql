-- Drop the two unused time fields from routines: a routine is "done today or
-- not", regardless of clock time. `specific_time` was only display+sort;
-- `notify` was never wired to any reminder path (reminders cron reads `tasks`
-- only). Idempotent; reloads the PostgREST schema cache.

ALTER TABLE routines
  DROP COLUMN IF EXISTS specific_time,
  DROP COLUMN IF EXISTS notify;

NOTIFY pgrst, 'reload schema';
