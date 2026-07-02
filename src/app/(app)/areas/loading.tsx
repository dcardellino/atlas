import { SkeletonScreen } from "@/components/ui/Skeleton";

// Areas loading state (TASK-050): skeleton cards, not a spinner.
export default function AreasLoading() {
  return <SkeletonScreen eyebrow="Lebensbereiche" title="Areas" rows={4} />;
}
