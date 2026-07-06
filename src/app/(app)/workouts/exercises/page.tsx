import WorkoutHeader from "@/components/features/workouts/WorkoutHeader";
import ExerciseLibrary from "@/components/features/workouts/ExerciseLibrary";
import { listExercises } from "@/lib/workouts/actions";
import { seedDefaultExercises } from "@/lib/workouts/seed";

// Übungs-Bibliothek verwalten.
export default async function ExercisesPage() {
  await seedDefaultExercises();
  const exercises = await listExercises();
  return (
    <section>
      <WorkoutHeader title="Übungen" />
      <ExerciseLibrary exercises={exercises} />
    </section>
  );
}
