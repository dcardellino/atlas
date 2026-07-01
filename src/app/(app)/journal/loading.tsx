import { SkeletonScreen } from "@/components/ui/Skeleton";

// Journal loading state (TASK-050): skeleton cards, not a spinner.
export default function JournalLoading() {
  return <SkeletonScreen eyebrow="Journal" title="Journal" rows={5} />;
}
