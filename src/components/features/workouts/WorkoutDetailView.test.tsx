import { describe, expect, it } from "vitest";
import { setSummary } from "./WorkoutDetailView";
import type { WorkoutSet } from "@/lib/workouts/types";

function makeSet(partial: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: "s1",
    workout_id: "w1",
    block_id: "b1",
    exercise_id: null,
    exercise_name: "Test",
    position: 0,
    set_number: null,
    reps: null,
    weight_kg: null,
    distance_m: null,
    duration_seconds: null,
    calories: null,
    rpe: null,
    is_warmup: false,
    created_at: "2026-07-06T00:00:00Z",
    ...partial,
  };
}

describe("setSummary", () => {
  it("zeigt RPE wenn vorhanden", () => {
    const result = setSummary(makeSet({ rpe: 8 }));
    expect(result).toContain("RPE 8");
  });

  it("berechnet Pace korrekt: 5000m / 1500s → 5:00 /km", () => {
    const result = setSummary(makeSet({ distance_m: 5000, duration_seconds: 1500 }));
    expect(result).toContain("5:00 /km");
  });

  it("zeigt keine Pace wenn Distanz fehlt", () => {
    const result = setSummary(makeSet({ duration_seconds: 300 }));
    expect(result).not.toContain("/km");
  });

  it("zeigt keine Pace wenn Dauer fehlt", () => {
    const result = setSummary(makeSet({ distance_m: 1000 }));
    expect(result).not.toContain("/km");
  });

  it("zeigt keine Pace wenn distance_m = 0", () => {
    const result = setSummary(makeSet({ distance_m: 0, duration_seconds: 300 }));
    expect(result).not.toContain("/km");
  });

  it("zeigt kein RPE wenn rpe null", () => {
    const result = setSummary(makeSet({ rpe: null }));
    expect(result).not.toContain("RPE");
  });

  it("Regressionsschutz: reps + weight_kg rendert wie zuvor", () => {
    const result = setSummary(makeSet({ reps: 5, weight_kg: 100 }));
    expect(result).toBe("5 Wdh. · 100 kg");
  });

  it("gibt '—' zurück wenn keine Metriken vorhanden", () => {
    const result = setSummary(makeSet({}));
    expect(result).toBe("—");
  });

  it("RPE steht am Ende der Zusammenfassung", () => {
    const result = setSummary(makeSet({ reps: 3, weight_kg: 80, rpe: 7 }));
    expect(result).toBe("3 Wdh. · 80 kg · RPE 7");
  });

  it("Pace + RPE gemeinsam", () => {
    const result = setSummary(makeSet({ distance_m: 5000, duration_seconds: 1500, rpe: 6 }));
    expect(result).toContain("5:00 /km");
    expect(result).toContain("RPE 6");
    // RPE nach Pace
    expect(result.indexOf("5:00 /km")).toBeLessThan(result.indexOf("RPE 6"));
  });
});
