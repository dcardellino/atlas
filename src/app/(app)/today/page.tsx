import TodayView from "@/components/features/today/TodayView";
import { summary, type TodaySummary } from "@/lib/today/summary";
import { createClient } from "@/lib/supabase/server";

// Today entry point (TASK-021). Server-fetches the summary; on failure renders
// the error state inline (no crash) per PRD § UI/UX > Today. Areas are loaded
// for the manual "Neue Aufgabe" editor.
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the summary and the areas concurrently — they're independent, so there's
  // no reason to serialize the two round-trips on the Today critical path (TASK-055).
  const [summaryResult, areasRes] = await Promise.all([
    summary().then(
      (d) => ({ data: d as TodaySummary | undefined }),
      () => ({ data: undefined }),
    ),
    user
      ? supabase
          .from("areas")
          .select("id, name")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const data = summaryResult.data;
  const areas = areasRes.data ?? [];

  return data ? (
    <TodayView data={data} areas={areas} />
  ) : (
    <TodayView error areas={areas} />
  );
}
