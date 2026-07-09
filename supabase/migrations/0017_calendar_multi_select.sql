-- supabase/migrations/0017_calendar_multi_select.sql
-- Atlas — Kalender-Mehrfachauswahl (Settings-Restructure).
-- Erlaubt die Auswahl mehrerer Google-Kalender statt nur "primary". Idempotent;
-- reloadet den PostgREST-Schema-Cache am Ende.

alter table calendar_sync_state
  add column if not exists selected_calendar_ids text[] not null default array['primary'];

-- Google-Event-IDs sind nur innerhalb eines Kalenders eindeutig — bei mehreren
-- ausgewählten Kalendern könnten sonst IDs kollidieren.
alter table calendar_events
  drop constraint if exists calendar_events_user_id_external_id_key;
alter table calendar_events
  add constraint calendar_events_user_id_calendar_id_external_id_key
    unique (user_id, calendar_id, external_id);

notify pgrst, 'reload schema';
