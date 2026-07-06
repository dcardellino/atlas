-- Atlas — RPE pro Satz (Rate of Perceived Exertion, 0–10, halbe Schritte).
-- Additive, nullable Spalte fürs Kraft-Layout; bricht keine Bestandsdaten.
alter table workout_sets add column if not exists rpe numeric(3, 1)
  check (rpe is null or (rpe >= 0 and rpe <= 10));
notify pgrst, 'reload schema';
