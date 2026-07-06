import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function WorkoutStatsLoading() {
  return <SkeletonScreen eyebrow="Training" title="Statistik" rows={4} />;
}
