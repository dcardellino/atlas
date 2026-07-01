import JournalFeed from "@/components/features/journal/JournalFeed";
import { listFeed } from "@/lib/journal/actions";
import { createClient } from "@/lib/supabase/server";

// Journal entry point (TASK-039, FR-008). Fetches the feed (with resolved media
// signed URLs) and the user's areas server-side; JournalFeed handles the
// composer (text/voice/photo) and deletion. userId is passed for the client-side
// Storage upload path (<userId>/<entryId>/…), matching the bucket RLS (0005).
export default async function JournalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [feed, areasRes] = await Promise.all([
    listFeed(),
    user
      ? supabase
          .from("areas")
          .select("id, name")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return (
    <JournalFeed
      feed={feed}
      areas={areasRes.data ?? []}
      userId={user?.id ?? ""}
    />
  );
}
