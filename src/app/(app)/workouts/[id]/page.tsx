import { notFound } from "next/navigation";
import WorkoutDetailView from "@/components/features/workouts/WorkoutDetailView";
import { getWorkout } from "@/lib/workouts/actions";

// Read-only Detailansicht eines Workouts.
export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workout = await getWorkout(id);
  if (!workout) notFound();
  return <WorkoutDetailView workout={workout} />;
}
