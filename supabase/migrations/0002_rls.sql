-- Atlas — Row Level Security (PRD § Data Model / § Security Considerations)
-- Every user table: RLS on + policy auth.uid() = user_id for every operation.
-- SELECT/DELETE use USING; INSERT uses WITH CHECK; UPDATE uses both.

-- areas
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_select" ON areas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "areas_insert" ON areas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "areas_update" ON areas FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "areas_delete" ON areas FOR DELETE USING (auth.uid() = user_id);

-- inbox_items
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_items_select" ON inbox_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inbox_items_insert" ON inbox_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inbox_items_update" ON inbox_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inbox_items_delete" ON inbox_items FOR DELETE USING (auth.uid() = user_id);

-- tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- routines
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routines_select" ON routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routines_insert" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_update" ON routines FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routines_delete" ON routines FOR DELETE USING (auth.uid() = user_id);

-- routine_logs
ALTER TABLE routine_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routine_logs_select" ON routine_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "routine_logs_insert" ON routine_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_logs_update" ON routine_logs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "routine_logs_delete" ON routine_logs FOR DELETE USING (auth.uid() = user_id);

-- journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_entries_select" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_entries_insert" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_entries_update" ON journal_entries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_entries_delete" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

-- journal_media
ALTER TABLE journal_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_media_select" ON journal_media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "journal_media_insert" ON journal_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_media_update" ON journal_media FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "journal_media_delete" ON journal_media FOR DELETE USING (auth.uid() = user_id);

-- api_tokens
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_tokens_select" ON api_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "api_tokens_insert" ON api_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_tokens_update" ON api_tokens FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_tokens_delete" ON api_tokens FOR DELETE USING (auth.uid() = user_id);
