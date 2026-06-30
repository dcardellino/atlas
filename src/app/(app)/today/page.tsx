import TodayView from "@/components/features/today/TodayView";
import { summary, type TodaySummary } from "@/lib/today/summary";

// Today entry point (TASK-021). Server-fetches the summary; on failure renders
// the error state inline (no crash) per PRD § UI/UX > Today.
export default async function TodayPage() {
  let data: TodaySummary | undefined;
  try {
    data = await summary();
  } catch {
    data = undefined;
  }
  return data ? <TodayView data={data} /> : <TodayView error />;
}
