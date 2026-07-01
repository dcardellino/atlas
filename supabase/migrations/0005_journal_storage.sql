-- Atlas — Journal media storage (TASK-038, FR-008).
-- PRD § Technical Architecture > Security: "Journal-Fotos in privatem Supabase-
-- Storage-Bucket mit signed URLs, RLS-geschützt."
--
-- Creates the private `journal-media` bucket and owner-scoped RLS policies on
-- storage.objects. Object path convention: <user_id>/<journal_entry_id>/<uuid>.<ext>
-- — the first path segment is the owner, and the policies gate on it. Fully
-- idempotent (safe to re-run against the shared Preview/Prod DB).

insert into storage.buckets (id, name, public)
values ('journal-media', 'journal-media', false)
on conflict (id) do nothing;

-- Owner-only object access: first path segment must equal the caller's uid.
drop policy if exists "journal_media_objects_select" on storage.objects;
create policy "journal_media_objects_select" on storage.objects
  for select using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "journal_media_objects_insert" on storage.objects;
create policy "journal_media_objects_insert" on storage.objects
  for insert with check (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "journal_media_objects_update" on storage.objects;
create policy "journal_media_objects_update" on storage.objects
  for update using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "journal_media_objects_delete" on storage.objects;
create policy "journal_media_objects_delete" on storage.objects
  for delete using (
    bucket_id = 'journal-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
