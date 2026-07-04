import WorkoutHeader from "@/components/features/workouts/WorkoutHeader";
import WorkoutList from "@/components/features/workouts/WorkoutList";
import { listWorkouts } from "@/lib/workouts/actions";
import { seedDefaultExercises } from "@/lib/workouts/seed";

// Workout-Verlauf (Einstieg). Seedet beim ersten Besuch die Standardbibliothek
// (lazy, nicht im App-Layout), lädt dann den Verlauf server-seitig.
export default async function WorkoutsPage() {
  await seedDefaultExercises();
  const workouts = await listWorkouts();

  return (
    <section>
      <WorkoutHeader title="Workout" action={{ href: "/workouts/new", label: "Neu" }} />
      <WorkoutList workouts={workouts} />
    </section>
  );
}
