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

  let data: TodaySummary | undefined;
  try {
    data = await summary();
  } catch {
    data = undefined;
  }

  const areasRes = user
    ? await supabase
        .from("areas")
        .select("id, name")
        .eq("user_id", user.id)
        .order("sort_order", { ascending: true })
    : { data: [] as { id: string; name: string }[] };
  const areas = areasRes.data ?? [];

  return data ? (
    <TodayView data={data} areas={areas} />
  ) : (
    <TodayView error areas={areas} />
  );
}
