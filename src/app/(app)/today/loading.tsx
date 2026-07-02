import { SkeletonScreen } from "@/components/ui/Skeleton";

// Today loading state (TASK-021 / TASK-050): skeleton cards, not a spinner.
export default function TodayLoading() {
  return <SkeletonScreen eyebrow="Heute" title="Today" rows={4} />;
}
