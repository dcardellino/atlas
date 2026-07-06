import { SkeletonScreen } from "@/components/ui/Skeleton";

export default function ExercisesLoading() {
  return <SkeletonScreen eyebrow="Training" title="Übungen" rows={6} />;
}
