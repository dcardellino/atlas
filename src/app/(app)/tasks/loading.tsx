import { SkeletonScreen } from "@/components/ui/Skeleton";

// Tasks loading state (TASK-050): skeleton cards, not a spinner.
export default function TasksLoading() {
  return <SkeletonScreen eyebrow="Aufgaben" title="Tasks" rows={6} />;
}
