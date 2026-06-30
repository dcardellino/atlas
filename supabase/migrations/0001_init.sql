-- Atlas — initial schema (PRD § Data Model > Entity Definitions)
-- All tables carry user_id -> auth.users for RLS (policies in 0002_rls.sql).

-- Lebensbereiche, oberste Organisationsebene
CREATE TABLE areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  color VARCHAR(20),                       -- Token-Name aus docs/design.md
  icon VARCHAR(40),
  sort_order INT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,            -- für spätere Slipping-Erkennung
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

-- Roh-Captures vor/parallel zur Klassifikation (Audit + Reklassifikation)
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,                  -- bereinigter Diktat-/Texteingabe-Text
  source VARCHAR(20) NOT NULL,             -- 'ios_shortcut' | 'pwa_voice' | 'pwa_text'
  classified_type VARCHAR(20),            -- 'task' | 'note' | 'journal' | 'routine' | null
  classified_into UUID,                    -- id des erzeugten Eintrags
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending'|'classified'|'failed'
  ai_meta JSONB,                           -- Modellantwort, Konfidenz, Latenz
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  is_top3 BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open' | 'done'
  completed_at TIMESTAMPTZ,
  recurrence VARCHAR(40),                  -- z.B. 'daily','weekly','monthly', null
  source_inbox_id UUID REFERENCES inbox_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routines (
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

CREATE TABLE routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (routine_id, log_date)
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(20) NOT NULL DEFAULT 'pwa_text',
  source_inbox_id UUID REFERENCES inbox_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,              -- Pfad im privaten Storage-Bucket
  media_type VARCHAR(20) NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Langlebige Tokens für den iOS-Shortcut (gehasht)
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  label VARCHAR(80),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
