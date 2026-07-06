-- Atlas — Workout Tracker (Kraft- + Hyrox-Workouts, Modi EMOM/AMRAP/Tabata/For Time).
-- Fünf Tabellen: exercises (Bibliothek), workouts (Session), workout_blocks
-- (Segment mit Modus), workout_sets (einzelne Efforts) und workout_templates
-- (wiederverwendbare Pläne, JSONB). Jede Tabelle trägt user_id -> auth.users,
-- damit jede RLS-Policy die triviale Form auth.uid() = user_id behält (kein
-- EXISTS-Subquery auf die Elternzeile). Vollständig idempotent; lädt am Ende den
-- PostgREST-Schema-Cache neu. Stil gespiegelt von 0006_reminders_calendar.sql.

-- --- Übungs-/Stationsbibliothek ---------------------------------------------
-- Pro Nutzer; wird beim ersten Besuch der Workouts-Seite mit Hyrox-Stationen +
-- gängigen Lifts geseedet (is_default = true). `metrics` steuert, welche
-- Eingabefelder der Logger je Übung zeigt (eine Station kann mehrere tracken).
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name varchar(160) not null,
  category varchar(20) not null default 'strength'
    check (category in ('strength', 'hyrox', 'cardio', 'bodyweight', 'other')),
  -- Welche Metriken relevant sind: 'reps' | 'weight' | 'distance' | 'duration' | 'calories'.
  metrics text[] not null default '{reps,weight}',
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- --- Workout-Session (Protokoll-Kopf) ---------------------------------------
-- performed_on ist ein reines DATE: nachträgliches Loggen kennt selten die
-- Uhrzeit, alle Statistiken bucketen nach Tag, und ein DATE vermeidet
-- Zeitzonen-Drift in den Charts.
create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name varchar(160) not null,
  type varchar(20) not null default 'strength'
    check (type in ('strength', 'hyrox', 'wod', 'cardio', 'other')),
  -- Blöcke + Übungen OHNE Ergebnisse; Shape wird per Zod beim Schreiben geprüft.
  structure jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_id uuid references areas(id) on delete set null,
  title varchar(160),
  type varchar(20) not null default 'strength'
    check (type in ('strength', 'hyrox', 'wod', 'cardio', 'other')),
  performed_on date not null default current_date,
  notes text,
  perceived_effort smallint check (perceived_effort between 1 and 10),
  total_duration_seconds int check (total_duration_seconds is null or total_duration_seconds >= 0),
  template_id uuid references workout_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- Block: das Segment, das den MODUS + modus-Ergebnisse trägt --------------
-- Config-Spalten (duration/interval/rest/rounds) und Ergebnis-Spalten
-- (result_*) sind alle nullable; welche gefüllt werden, hängt vom Modus ab.
create table if not exists workout_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  mode varchar(20) not null default 'straight'
    check (mode in ('straight', 'emom', 'amrap', 'tabata', 'for_time', 'interval')),
  name varchar(160),
  position int not null default 0,
  -- Modus-Konfiguration
  duration_seconds int,
  interval_seconds int,
  rest_seconds int,
  rounds int,
  -- Ergebnis
  result_rounds int,
  result_reps int,
  result_seconds int,
  notes text,
  created_at timestamptz not null default now()
);

-- --- Set: einzelner Effort ---------------------------------------------------
-- exercise_id liegt bewusst auf dem Set (nicht dem Block), damit Supersätze und
-- Hyrox-Lauf/Station uniform sind. exercise_name ist ein denormalisierter
-- Snapshot: übersteht Umbenennen/Löschen der Bibliotheks-Übung und Freitext.
create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  block_id uuid not null references workout_blocks(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name varchar(160) not null,
  position int not null default 0,
  set_number int,
  reps int,
  weight_kg numeric(6, 2),
  distance_m int,
  duration_seconds int,
  calories int,
  is_warmup boolean not null default false,
  created_at timestamptz not null default now()
);

-- --- Indizes ----------------------------------------------------------------
create index if not exists workouts_user_performed_idx on workouts (user_id, performed_on desc);
create index if not exists workout_blocks_workout_pos_idx on workout_blocks (workout_id, position);
create index if not exists workout_sets_workout_block_idx on workout_sets (workout_id, block_id);
create index if not exists workout_sets_user_exercise_idx on workout_sets (user_id, exercise_id);
create index if not exists exercises_user_active_idx on exercises (user_id) where archived_at is null;
create index if not exists workout_templates_user_idx on workout_templates (user_id, created_at desc);

-- --- RLS + Policies (mirror 0002_rls.sql; DROP-then-CREATE = idempotent) -----
alter table exercises enable row level security;
drop policy if exists "exercises_select" on exercises;
create policy "exercises_select" on exercises for select using (auth.uid() = user_id);
drop policy if exists "exercises_insert" on exercises;
create policy "exercises_insert" on exercises for insert with check (auth.uid() = user_id);
drop policy if exists "exercises_update" on exercises;
create policy "exercises_update" on exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exercises_delete" on exercises;
create policy "exercises_delete" on exercises for delete using (auth.uid() = user_id);

alter table workout_templates enable row level security;
drop policy if exists "workout_templates_select" on workout_templates;
create policy "workout_templates_select" on workout_templates for select using (auth.uid() = user_id);
drop policy if exists "workout_templates_insert" on workout_templates;
create policy "workout_templates_insert" on workout_templates for insert with check (auth.uid() = user_id);
drop policy if exists "workout_templates_update" on workout_templates;
create policy "workout_templates_update" on workout_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_templates_delete" on workout_templates;
create policy "workout_templates_delete" on workout_templates for delete using (auth.uid() = user_id);

alter table workouts enable row level security;
drop policy if exists "workouts_select" on workouts;
create policy "workouts_select" on workouts for select using (auth.uid() = user_id);
drop policy if exists "workouts_insert" on workouts;
create policy "workouts_insert" on workouts for insert with check (auth.uid() = user_id);
drop policy if exists "workouts_update" on workouts;
create policy "workouts_update" on workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workouts_delete" on workouts;
create policy "workouts_delete" on workouts for delete using (auth.uid() = user_id);

alter table workout_blocks enable row level security;
drop policy if exists "workout_blocks_select" on workout_blocks;
create policy "workout_blocks_select" on workout_blocks for select using (auth.uid() = user_id);
drop policy if exists "workout_blocks_insert" on workout_blocks;
create policy "workout_blocks_insert" on workout_blocks for insert with check (auth.uid() = user_id);
drop policy if exists "workout_blocks_update" on workout_blocks;
create policy "workout_blocks_update" on workout_blocks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_blocks_delete" on workout_blocks;
create policy "workout_blocks_delete" on workout_blocks for delete using (auth.uid() = user_id);

alter table workout_sets enable row level security;
drop policy if exists "workout_sets_select" on workout_sets;
create policy "workout_sets_select" on workout_sets for select using (auth.uid() = user_id);
drop policy if exists "workout_sets_insert" on workout_sets;
create policy "workout_sets_insert" on workout_sets for insert with check (auth.uid() = user_id);
drop policy if exists "workout_sets_update" on workout_sets;
create policy "workout_sets_update" on workout_sets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_sets_delete" on workout_sets;
create policy "workout_sets_delete" on workout_sets for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
