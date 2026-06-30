import TaskList from "@/components/features/tasks/TaskList";
import { list } from "@/lib/tasks/actions";
import { createClient } from "@/lib/supabase/server";

// Tasks entry point (TASK-022). Fetches all tasks + areas server-side; TaskList
// handles filtering and editing client-side.
export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tasks, areasRes] = await Promise.all([
    list({ status: "all" }),
    user
      ? supabase
          .from("areas")
          .select("id, name")
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return <TaskList tasks={tasks} areas={areasRes.data ?? []} />;
}
