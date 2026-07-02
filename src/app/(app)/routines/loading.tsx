import { SkeletonScreen } from "@/components/ui/Skeleton";

// Routines loading state (TASK-050): skeleton cards, not a spinner.
export default function RoutinesLoading() {
  return <SkeletonScreen eyebrow="Routinen" title="Routines" rows={5} />;
}
