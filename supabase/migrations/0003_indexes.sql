-- Atlas — indexes (PRD § Data Model > Indexes)

-- Today-View und Tasks-Liste nach Fälligkeit
CREATE INDEX tasks_user_status_due_idx ON tasks (user_id, status, due_at);

-- schneller Top-3-Zugriff
CREATE INDEX tasks_user_top3_idx ON tasks (user_id, is_top3) WHERE is_top3;

-- Streak-Berechnung
CREATE INDEX routine_logs_routine_date_idx ON routine_logs (routine_id, log_date);

-- Journal-Feed
CREATE INDEX journal_entries_user_date_idx ON journal_entries (user_id, entry_date DESC);

-- „kürzlich erfasst" und Fehler-Recovery
CREATE INDEX inbox_items_user_status_created_idx ON inbox_items (user_id, status, created_at DESC);

-- geordnete Bereichsliste
CREATE INDEX areas_user_sort_idx ON areas (user_id, sort_order);

-- Token-Lookup beim Capture
CREATE INDEX api_tokens_token_hash_idx ON api_tokens (token_hash);
