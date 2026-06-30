-- Repair migration (Phase 2): ensure the `routines` and `routine_logs` tables,
-- their RLS policies and the streak index exist in every environment.
--
-- Symptom this fixes: PostgREST error PGRST205 "Could not find the table
-- 'public.routines' in the schema cache" when creating a routine in production.
-- The tables are defined in 0001/0002/0003, but those migrations predate the
-- production database (or were only partially applied), so the routines schema
-- never landed there. This migration is fully idempotent — safe to run whether
-- the tables already exist (no-op) or not (created) — and reloads the PostgREST
-- schema cache at the end so the new tables are immediately visible.

-- --- Tables (mirror 0001_init.sql exactly) ------------------------------------

CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  time_of_day VARCHAR(20) NOT NULL DEFAULT 'anytime', -- 'morning'|'afternoon'|'evening'|'anytime'
  specific_time TIME,
  notify BOOLEAN NOT NULL DEFAULT FALSE,
  duration_days INT,                       -- null = ongoing, sonst befristeter Streak
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (routine_id, log_date)
);

-- --- RLS + policies (mirror 0002_rls.sql; DROP-then-CREATE = idempotent) ------

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routines_select" ON routines;
CREATE POLICY "routines_select" ON routines FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "routines_insert" ON routines;
CREATE POLICY "routines_insert" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "routines_update" ON routines;
CREATE POLICY "routines_update" ON routines FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "routines_delete" ON routines;
CREATE POLICY "routines_delete" ON routines FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE routine_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routine_logs_select" ON routine_logs;
CREATE POLICY "routine_logs_select" ON routine_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "routine_logs_insert" ON routine_logs;
CREATE POLICY "routine_logs_insert" ON routine_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "routine_logs_update" ON routine_logs;
CREATE POLICY "routine_logs_update" ON routine_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "routine_logs_delete" ON routine_logs;
CREATE POLICY "routine_logs_delete" ON routine_logs FOR DELETE USING (auth.uid() = user_id);

-- --- Index (mirror 0003_indexes.sql) -----------------------------------------

CREATE INDEX IF NOT EXISTS routine_logs_routine_date_idx ON routine_logs (routine_id, log_date);

-- --- Refresh PostgREST's schema cache so the tables are visible immediately ---

NOTIFY pgrst, 'reload schema';
