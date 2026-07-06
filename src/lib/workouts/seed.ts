import { createClient } from "@/lib/supabase/server";
import { DEFAULT_EXERCISES } from "@/lib/workouts/types";

/**
 * Standard-Übungsbibliothek, die beim ersten Öffnen des Workout-Trackers je
 * Nutzer angelegt wird (Hyrox-Stationen + gängige Lifts, is_default = true).
 * Gespiegelt von src/lib/areas/seed.ts: idempotent, per-Instance-memoisiert.
 *
 * Bewusst NICHT im (app)/layout.tsx aufrufen — sonst würden ~20 Zeilen für jeden
 * Nutzer bei jedem Request angelegt. Stattdessen lazy in den Workouts-Seiten.
 */

// Per-Instance-Memo bereits versorgter Nutzer (analog zu seedDefaultAreas).
const ensured = new Set<string>();

/**
 * Idempotent sicherstellen, dass der Nutzer seine Default-Übungen hat. No-op,
 * sobald irgendeine Übung existiert — safe bei jedem Aufruf. Das UNIQUE
 * (user_id, name) macht ein erneutes Seeding ohnehin fehlerfrei.
 */
export async function seedDefaultExercises(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (ensured.has(user.id)) return;

  const { count, error } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) return;
  if ((count ?? 0) > 0) {
    ensured.add(user.id);
    return;
  }

  await supabase.from("exercises").insert(
    DEFAULT_EXERCISES.map((ex) => ({
      user_id: user.id,
      name: ex.name,
      category: ex.category,
      metrics: ex.metrics,
      is_default: true,
    })),
  );
  ensured.add(user.id);
}
