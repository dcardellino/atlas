import RoutineList from "@/components/features/routines/RoutineList";
import { listWithState } from "@/lib/routines/actions";
import { createClient } from "@/lib/supabase/server";

// Routines entry point (TASK-032). Fetches active routines (with streak state)
// and areas server-side; RoutineList handles check-off and editing.
export default async function RoutinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [routines, areasRes] = await Promise.all([
    listWithState(),
    user
      ? supabase
          .from("areas")
          .select("id, name")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return <RoutineList routines={routines} areas={areasRes.data ?? []} />;
}
