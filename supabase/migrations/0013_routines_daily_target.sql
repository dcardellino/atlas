-- Frequenz "N-mal pro Tag": Zielzähler auf der Routine + Tageszähler auf dem Log.
-- A routine may have at most one frequency kind: daily_target (N/day) and
-- weekly_target (N/week) are mutually exclusive. routine_logs keeps one row per
-- (routine, day); `count` records how many check-offs happened that day.

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS daily_target INT
  CHECK (daily_target IS NULL OR daily_target BETWEEN 2 AND 20);

-- Exactly one frequency kind: never both daily_target and weekly_target set.
ALTER TABLE routines DROP CONSTRAINT IF EXISTS routines_single_frequency;
ALTER TABLE routines ADD CONSTRAINT routines_single_frequency
  CHECK (daily_target IS NULL OR weekly_target IS NULL);

-- Per-day check-off count; existing rows default to 1. A day with 0 check-offs
-- has no row (deleted), so count is always >= 1.
ALTER TABLE routine_logs
  ADD COLUMN IF NOT EXISTS count INT NOT NULL DEFAULT 1
  CHECK (count >= 1);

NOTIFY pgrst, 'reload schema';
