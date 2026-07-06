import WorkoutLogger from "@/components/features/workouts/WorkoutLogger";
import { listExercises } from "@/lib/workouts/actions";
import { seedDefaultExercises } from "@/lib/workouts/seed";

// Neues Workout protokollieren. Seedet die Bibliothek (falls nötig) und lädt sie
// für den Übungs-Picker.
export default async function NewWorkoutPage() {
  await seedDefaultExercises();
  const exercises = await listExercises();
  return <WorkoutLogger exercises={exercises} />;
}
