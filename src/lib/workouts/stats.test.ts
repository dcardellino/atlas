import { describe, expect, it } from "vitest";
import {
  estimatedOneRepMax,
  setVolume,
  volumeBySession,
  frequencyByWeek,
  exerciseProgression,
  hyroxStationTimes,
  personalRecords,
  type StatSet,
  type StatWorkout,
} from "./stats";

function set(partial: Partial<StatSet>): StatSet {
  return {
    workout_id: "w1",
    exercise_name: "Kniebeuge",
    reps: null,
    weight_kg: null,
    distance_m: null,
    duration_seconds: null,
    ...partial,
  };
}

describe("estimatedOneRepMax (Epley)", () => {
  it("returns the weight itself for a single rep", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
  });

  it("applies weight * (1 + reps/30)", () => {
    // 100 * (1 + 5/30) = 116.67 -> gerundet 116.7
    expect(estimatedOneRepMax(100, 5)).toBe(116.7);
  });

  it("returns null when weight or reps are missing or non-positive", () => {
    expect(estimatedOneRepMax(null, 5)).toBeNull();
    expect(estimatedOneRepMax(100, null)).toBeNull();
    expect(estimatedOneRepMax(0, 5)).toBeNull();
    expect(estimatedOneRepMax(100, 0)).toBeNull();
  });
});

describe("setVolume", () => {
  it("is reps × weight", () => {
    expect(setVolume(set({ reps: 5, weight_kg: 100 }))).toBe(500);
  });
  it("is 0 when a component is missing", () => {
    expect(setVolume(set({ reps: 5 }))).toBe(0);
    expect(setVolume(set({ weight_kg: 100 }))).toBe(0);
  });
});

describe("volumeBySession", () => {
  it("sums volume per performed_on and sorts by date", () => {
    const workouts: StatWorkout[] = [
      { id: "w1", performed_on: "2026-07-02", type: "strength" },
      { id: "w2", performed_on: "2026-07-01", type: "strength" },
    ];
    const sets: StatSet[] = [
      set({ workout_id: "w1", reps: 5, weight_kg: 100 }), // 500
      set({ workout_id: "w1", reps: 5, weight_kg: 80 }), // 400
      set({ workout_id: "w2", reps: 10, weight_kg: 60 }), // 600
    ];
    expect(volumeBySession(workouts, sets)).toEqual([
      { date: "2026-07-01", volume: 600 },
      { date: "2026-07-02", volume: 900 },
    ]);
  });

  it("ignores sets whose workout is unknown", () => {
    const workouts: StatWorkout[] = [
      { id: "w1", performed_on: "2026-07-02", type: "strength" },
    ];
    const sets = [set({ workout_id: "ghost", reps: 5, weight_kg: 100 })];
    expect(volumeBySession(workouts, sets)).toEqual([]);
  });
});

describe("frequencyByWeek", () => {
  it("counts workouts per ISO week (Monday start)", () => {
    // 2026-06-29 Mo, 2026-07-01 Mi -> gleiche Woche; 2026-07-06 -> nächste Woche
    const workouts: StatWorkout[] = [
      { id: "a", performed_on: "2026-06-29", type: "strength" },
      { id: "b", performed_on: "2026-07-01", type: "hyrox" },
      { id: "c", performed_on: "2026-07-06", type: "strength" },
    ];
    expect(frequencyByWeek(workouts)).toEqual([
      { week: "2026-06-29", count: 2 },
      { week: "2026-07-06", count: 1 },
    ]);
  });
});

describe("exerciseProgression", () => {
  const workouts: StatWorkout[] = [
    { id: "w1", performed_on: "2026-07-01", type: "strength" },
    { id: "w2", performed_on: "2026-07-08", type: "strength" },
  ];

  it("tracks max weight and best est-1RM per date, ignoring other exercises", () => {
    const sets: StatSet[] = [
      set({ workout_id: "w1", exercise_name: "Kniebeuge", reps: 5, weight_kg: 100 }),
      set({ workout_id: "w1", exercise_name: "Kniebeuge", reps: 3, weight_kg: 110 }),
      set({ workout_id: "w1", exercise_name: "Bankdrücken", reps: 5, weight_kg: 80 }),
      set({ workout_id: "w2", exercise_name: "Kniebeuge", reps: 5, weight_kg: 105 }),
    ];
    const prog = exerciseProgression(workouts, sets, "Kniebeuge");
    expect(prog.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-08"]);
    expect(prog[0].maxWeight).toBe(110);
    // e1RM: 100@5 = 116.7 vs 110@3 = 121 -> 121
    expect(prog[0].estOneRepMax).toBe(121);
    expect(prog[1].maxWeight).toBe(105);
  });

  it("returns empty when the exercise never had a weight", () => {
    const sets = [set({ exercise_name: "Plank", duration_seconds: 60 })];
    expect(exerciseProgression(workouts, sets, "Plank")).toEqual([]);
  });
});

describe("hyroxStationTimes", () => {
  it("keeps the fastest time per date, ascending", () => {
    const workouts: StatWorkout[] = [
      { id: "w1", performed_on: "2026-07-01", type: "hyrox" },
      { id: "w2", performed_on: "2026-06-20", type: "hyrox" },
    ];
    const sets: StatSet[] = [
      set({ workout_id: "w1", exercise_name: "SkiErg", duration_seconds: 250 }),
      set({ workout_id: "w1", exercise_name: "SkiErg", duration_seconds: 240 }),
      set({ workout_id: "w2", exercise_name: "SkiErg", duration_seconds: 265 }),
    ];
    expect(hyroxStationTimes(workouts, sets, "SkiErg")).toEqual([
      { date: "2026-06-20", bestSeconds: 265 },
      { date: "2026-07-01", bestSeconds: 240 },
    ]);
  });
});

describe("personalRecords", () => {
  it("derives max weight, best e1RM, max reps, distance and fastest time per exercise", () => {
    const sets: StatSet[] = [
      set({ exercise_name: "Kniebeuge", reps: 5, weight_kg: 100 }),
      set({ exercise_name: "Kniebeuge", reps: 3, weight_kg: 110 }),
      set({ exercise_name: "SkiErg", distance_m: 1000, duration_seconds: 250 }),
      set({ exercise_name: "SkiErg", distance_m: 1000, duration_seconds: 240 }),
    ];
    const prs = personalRecords(sets);
    const squat = prs.find((p) => p.exercise_name === "Kniebeuge")!;
    expect(squat.maxWeight).toBe(110);
    expect(squat.bestEstOneRepMax).toBe(121); // 110@3
    expect(squat.maxReps).toBe(5);
    const ski = prs.find((p) => p.exercise_name === "SkiErg")!;
    expect(ski.bestSeconds).toBe(240);
    expect(ski.maxDistance).toBe(1000);
    // alphabetisch sortiert
    expect(prs.map((p) => p.exercise_name)).toEqual(["Kniebeuge", "SkiErg"]);
  });

  it("returns empty for no sets", () => {
    expect(personalRecords([])).toEqual([]);
  });
});
