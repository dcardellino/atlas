import WorkoutHeader from "@/components/features/workouts/WorkoutHeader";
import WorkoutStats from "@/components/features/workouts/WorkoutStats";
import { loadStatsData } from "@/lib/workouts/actions";
import {
  frequencyByWeek,
  volumeBySession,
  personalRecords,
  exerciseProgression,
  hyroxStationTimes,
} from "@/lib/workouts/stats";

// Statistik-Seite. Lädt Workouts + Sätze und berechnet alles über das reine
// stats.ts-Modul server-seitig; die Client-Komponente rendert nur die Charts.
export default async function WorkoutStatsPage() {
  const { workouts, sets } = await loadStatsData();

  const frequency = frequencyByWeek(workouts);
  const volume = volumeBySession(workouts, sets);
  const prs = personalRecords(sets);

  // Progression je Übung, die je ein Gewicht getragen hat.
  const withWeight = new Set(
    sets.filter((s) => s.weight_kg != null).map((s) => s.exercise_name),
  );
  const progression: Record<string, { date: string; estOneRepMax: number }[]> = {};
  for (const name of withWeight) {
    const series = exerciseProgression(workouts, sets, name);
    if (series.length > 0)
      progression[name] = series.map((p) => ({
        date: p.date,
        estOneRepMax: p.estOneRepMax,
      }));
  }

  // Stationszeiten je Übung, die je eine Dauer getragen hat.
  const withDuration = new Set(
    sets.filter((s) => s.duration_seconds != null).map((s) => s.exercise_name),
  );
  const stationTimes: Record<string, { date: string; bestSeconds: number }[]> = {};
  for (const name of withDuration) {
    const series = hyroxStationTimes(workouts, sets, name);
    if (series.length > 0) stationTimes[name] = series;
  }

  return (
    <section>
      <WorkoutHeader title="Statistik" />
      <WorkoutStats
        frequency={frequency}
        volume={volume}
        prs={prs}
        progression={progression}
        stationTimes={stationTimes}
      />
    </section>
  );
}
