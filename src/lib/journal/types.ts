/**
 * Journal types (TASK-037). A Server Actions module may only export async
 * functions, so the row/DTO types live here alongside the media constants.
 * Mirrors the `journal_entries` / `journal_media` schema (0001_init.sql).
 */

export type JournalEntry = {
  id: string;
  area_id: string | null;
  body: string;
  entry_date: string;
  source: string;
  created_at: string;
};

export type JournalMedia = {
  id: string;
  journal_entry_id: string;
  storage_path: string;
  media_type: string;
  created_at: string;
};

/** A resolved feed item: entry + its media (with signed URLs) + area name. */
export type JournalFeedItem = JournalEntry & {
  area_name: string | null;
  media: { id: string; url: string | null; media_type: string }[];
};
