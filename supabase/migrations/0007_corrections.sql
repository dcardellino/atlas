-- Atlas — Classification corrections (TASK-053, FR-012).
-- When the user re-files a capture the AI mis-classified, we record the override
-- on the originating inbox_item. `corrected_type`/`corrected_area_id` hold the new
-- target, `corrected_at` marks when it happened. This is also the data source for
-- the AI-correction-rate metric (TASK-057): corrected rows ÷ classified rows.
-- Idempotent; reloads the PostgREST schema cache so the columns are visible now.

alter table inbox_items add column if not exists corrected_type varchar(20);
alter table inbox_items
  add column if not exists corrected_area_id uuid references areas(id) on delete set null;
alter table inbox_items add column if not exists corrected_at timestamptz;

-- Fast count of corrected captures for the metrics view.
create index if not exists inbox_items_corrected_idx
  on inbox_items (user_id, corrected_at)
  where corrected_at is not null;

notify pgrst, 'reload schema';
