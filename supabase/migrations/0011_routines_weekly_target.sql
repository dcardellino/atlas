-- Weekly-frequency routines: add an optional per-week target so a routine can be
-- "N-mal pro Woche" (e.g. Gym 4x/Woche) instead of strictly daily.
--
-- weekly_target semantics:
--   NULL   → daily routine (existing behaviour; streak = consecutive days)
--   1..7   → weekly routine; streak = consecutive weeks that reached N check-offs
--
-- routine_logs is unchanged: one row per completed day, as before. Idempotent
-- (ADD COLUMN IF NOT EXISTS); reloads the PostgREST schema cache so the new
-- column is immediately visible.

ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS weekly_target INT
  CHECK (weekly_target IS NULL OR (weekly_target BETWEEN 1 AND 7));

NOTIFY pgrst, 'reload schema';
