import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function WorkoutsLoading() {
  return <SkeletonScreen eyebrow="Training" title="Workout" rows={5} />;
}
