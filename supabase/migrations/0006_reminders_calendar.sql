-- Atlas — Reminders + Calendar cache (TASK-042/044, FR-009/FR-010).
-- Adds reminder de-dup tracking to `tasks`, plus the read-only Google Calendar
-- cache surfaced in the Today view. Fully idempotent; reloads the PostgREST
-- schema cache at the end so the new tables/columns are visible immediately.

-- --- Reminder de-dup ---------------------------------------------------------
-- The reminders cron sends one ntfy push per due task, then stamps this column
-- so a later run never re-sends the same reminder (FR-009).
alter table tasks add column if not exists reminder_sent_at timestamptz;

-- Fast scan for "due and not yet notified".
create index if not exists tasks_reminder_pending_idx
  on tasks (reminder_at)
  where status = 'open' and reminder_sent_at is null;

-- --- Calendar event cache ----------------------------------------------------
-- Read-only mirror of Google Calendar events (TASK-044). One row per external
-- event, refreshed by the calendar-sync cron. Never written from the UI.
create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null,               -- Google event id
  calendar_id text,                        -- Quell-Kalender (Default 'primary')
  summary text,                            -- Titel (kann leer sein)
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  html_link text,
  updated_at timestamptz,                  -- Googles 'updated'-Stempel des Events
  synced_at timestamptz not null default now(),
  unique (user_id, external_id)
);

-- Per-user sync status for the stale/error hint in Today + Settings (Edge Cases).
create table if not exists calendar_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_synced_at timestamptz,
  last_error text
);

-- --- RLS + policies (mirror 0002_rls.sql; DROP-then-CREATE = idempotent) ------
alter table calendar_events enable row level security;
drop policy if exists "calendar_events_select" on calendar_events;
create policy "calendar_events_select" on calendar_events for select using (auth.uid() = user_id);
drop policy if exists "calendar_events_insert" on calendar_events;
create policy "calendar_events_insert" on calendar_events for insert with check (auth.uid() = user_id);
drop policy if exists "calendar_events_update" on calendar_events;
create policy "calendar_events_update" on calendar_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendar_events_delete" on calendar_events;
create policy "calendar_events_delete" on calendar_events for delete using (auth.uid() = user_id);

alter table calendar_sync_state enable row level security;
drop policy if exists "calendar_sync_state_select" on calendar_sync_state;
create policy "calendar_sync_state_select" on calendar_sync_state for select using (auth.uid() = user_id);
drop policy if exists "calendar_sync_state_insert" on calendar_sync_state;
create policy "calendar_sync_state_insert" on calendar_sync_state for insert with check (auth.uid() = user_id);
drop policy if exists "calendar_sync_state_update" on calendar_sync_state;
create policy "calendar_sync_state_update" on calendar_sync_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendar_sync_state_delete" on calendar_sync_state;
create policy "calendar_sync_state_delete" on calendar_sync_state for delete using (auth.uid() = user_id);

-- --- Indexes -----------------------------------------------------------------
create index if not exists calendar_events_user_start_idx on calendar_events (user_id, start_at);

notify pgrst, 'reload schema';
