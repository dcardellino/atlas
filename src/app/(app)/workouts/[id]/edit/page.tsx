import { notFound } from "next/navigation";
import WorkoutLogger from "@/components/features/workouts/WorkoutLogger";
import { getWorkout, listExercises } from "@/lib/workouts/actions";

// Workout bearbeiten — der Logger im Edit-Modus (vorbefüllt).
export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workout, exercises] = await Promise.all([
    getWorkout(id),
    listExercises(),
  ]);
  if (!workout) notFound();
  return <WorkoutLogger exercises={exercises} workout={workout} />;
}
