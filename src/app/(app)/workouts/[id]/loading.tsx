import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function WorkoutDetailLoading() {
  return <SkeletonScreen eyebrow="Training" title="Workout" rows={4} />;
}
