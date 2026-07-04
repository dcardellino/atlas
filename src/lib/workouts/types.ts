/**
 * Workout-Tracker Typen und Konstanten. Bewusst aus der "use server"-actions.ts
 * herausgehalten, weil ein Server-Actions-Modul nur async-Funktionen exportieren
 * darf — ein Runtime-Const wie WORKOUT_MODES würde sonst den Build brechen
 * (gleiche Regel wie bei src/lib/routines/types.ts).
 */

export const WORKOUT_TYPES = [
  "strength",
  "hyrox",
  "wod",
  "cardio",
  "other",
] as const;
export type WorkoutType = (typeof WORKOUT_TYPES)[number];

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  strength: "Kraft",
  hyrox: "Hyrox",
  wod: "WOD",
  cardio: "Cardio",
  other: "Sonstiges",
};

// Der Modus lebt auf dem Block: EMOM/AMRAP/Tabata/For Time sind Segment-Konzepte.
export const WORKOUT_MODES = [
  "straight",
  "emom",
  "amrap",
  "tabata",
  "for_time",
  "interval",
] as const;
export type WorkoutMode = (typeof WORKOUT_MODES)[number];

export const WORKOUT_MODE_LABEL: Record<WorkoutMode, string> = {
  straight: "Sätze",
  emom: "EMOM",
  amrap: "AMRAP",
  tabata: "Tabata",
  for_time: "For Time",
  interval: "Intervall",
};

export const EXERCISE_CATEGORIES = [
  "strength",
  "hyrox",
  "cardio",
  "bodyweight",
  "other",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: "Kraft",
  hyrox: "Hyrox",
  cardio: "Cardio",
  bodyweight: "Körpergewicht",
  other: "Sonstiges",
};

// Trackbare Metriken pro Übung; steuert, welche Felder der Logger zeigt.
export const SET_METRICS = [
  "reps",
  "weight",
  "distance",
  "duration",
  "calories",
] as const;
export type SetMetric = (typeof SET_METRICS)[number];

export const SET_METRIC_LABEL: Record<SetMetric, string> = {
  reps: "Wdh.",
  weight: "Gewicht (kg)",
  distance: "Distanz (m)",
  duration: "Zeit (s)",
  calories: "Kalorien",
};

// --- Datenbank-Zeilen --------------------------------------------------------

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  metrics: SetMetric[];
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
};

export type Workout = {
  id: string;
  area_id: string | null;
  title: string | null;
  type: WorkoutType;
  performed_on: string; // ISO-Datum (yyyy-MM-dd)
  notes: string | null;
  perceived_effort: number | null;
  total_duration_seconds: number | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutBlock = {
  id: string;
  workout_id: string;
  mode: WorkoutMode;
  name: string | null;
  position: number;
  duration_seconds: number | null;
  interval_seconds: number | null;
  rest_seconds: number | null;
  rounds: number | null;
  result_rounds: number | null;
  result_reps: number | null;
  result_seconds: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  block_id: string;
  exercise_id: string | null;
  exercise_name: string;
  position: number;
  set_number: number | null;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_seconds: number | null;
  calories: number | null;
  is_warmup: boolean;
  created_at: string;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  type: WorkoutType;
  structure: TemplateBlock[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Ein Set innerhalb einer Vorlage — ohne Ergebnisse, mit Ziel-Vorgaben. */
export type TemplateSet = {
  exercise_id: string | null;
  exercise_name: string;
  set_number?: number | null;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  calories?: number | null;
  is_warmup?: boolean;
};

/** Ein Block innerhalb einer Vorlage — Modus + Config, ohne Ergebnisse. */
export type TemplateBlock = {
  mode: WorkoutMode;
  name?: string | null;
  duration_seconds?: number | null;
  interval_seconds?: number | null;
  rest_seconds?: number | null;
  rounds?: number | null;
  notes?: string | null;
  sets: TemplateSet[];
};

// --- Zusammengesetzte Sichten für die UI ------------------------------------

export type BlockWithSets = WorkoutBlock & { sets: WorkoutSet[] };

/** Ein Workout mit seinen Blöcken und Sätzen (Detail-/Editier-Ansicht). */
export type WorkoutDetail = Workout & { blocks: BlockWithSets[] };

// --- Eingabe-Payloads für die Actions ---------------------------------------

export type SetInput = {
  exercise_id?: string | null;
  exercise_name: string;
  set_number?: number | null;
  reps?: number | null;
  weight_kg?: number | null;
  distance_m?: number | null;
  duration_seconds?: number | null;
  calories?: number | null;
  is_warmup?: boolean;
};

export type BlockInput = {
  mode: WorkoutMode;
  name?: string | null;
  duration_seconds?: number | null;
  interval_seconds?: number | null;
  rest_seconds?: number | null;
  rounds?: number | null;
  result_rounds?: number | null;
  result_reps?: number | null;
  result_seconds?: number | null;
  notes?: string | null;
  sets: SetInput[];
};

export type WorkoutInput = {
  title?: string | null;
  type: WorkoutType;
  performed_on: string;
  notes?: string | null;
  perceived_effort?: number | null;
  total_duration_seconds?: number | null;
  area_id?: string | null;
  template_id?: string | null;
  blocks: BlockInput[];
};

// --- Standardbibliothek (Seed) ----------------------------------------------

/** Ein Eintrag der geseedeten Default-Bibliothek. */
export type DefaultExercise = {
  name: string;
  category: ExerciseCategory;
  metrics: SetMetric[];
};

/**
 * Die 8 Hyrox-Stationen (Renn-Legs kommen als eigene „Lauf"-Übung). Distanzen/
 * Wiederholungen entsprechen dem Standard-Rennformat; sie sind hier nur die
 * Vorbelegung, die eigentlichen Werte trägt der Nutzer je Workout im Set ein.
 */
export const HYROX_STATIONS: DefaultExercise[] = [
  { name: "Lauf (1 km)", category: "hyrox", metrics: ["distance", "duration"] },
  { name: "SkiErg", category: "hyrox", metrics: ["distance", "duration", "calories"] },
  { name: "Sled Push", category: "hyrox", metrics: ["distance", "weight", "duration"] },
  { name: "Sled Pull", category: "hyrox", metrics: ["distance", "weight", "duration"] },
  { name: "Burpee Broad Jumps", category: "hyrox", metrics: ["distance", "duration"] },
  { name: "Rudern", category: "hyrox", metrics: ["distance", "duration", "calories"] },
  { name: "Farmers Carry", category: "hyrox", metrics: ["distance", "weight", "duration"] },
  { name: "Sandbag Lunges", category: "hyrox", metrics: ["distance", "weight", "duration"] },
  { name: "Wall Balls", category: "hyrox", metrics: ["reps", "weight", "duration"] },
];

/** Gängige Kraft- und Körpergewichtsübungen. */
export const DEFAULT_STRENGTH_EXERCISES: DefaultExercise[] = [
  { name: "Kniebeuge", category: "strength", metrics: ["reps", "weight"] },
  { name: "Kreuzheben", category: "strength", metrics: ["reps", "weight"] },
  { name: "Bankdrücken", category: "strength", metrics: ["reps", "weight"] },
  { name: "Schulterdrücken", category: "strength", metrics: ["reps", "weight"] },
  { name: "Langhantelrudern", category: "strength", metrics: ["reps", "weight"] },
  { name: "Frontkniebeuge", category: "strength", metrics: ["reps", "weight"] },
  { name: "Hip Thrust", category: "strength", metrics: ["reps", "weight"] },
  { name: "Ausfallschritte", category: "strength", metrics: ["reps", "weight"] },
  { name: "Klimmzüge", category: "bodyweight", metrics: ["reps", "weight"] },
  { name: "Dips", category: "bodyweight", metrics: ["reps", "weight"] },
  { name: "Liegestütze", category: "bodyweight", metrics: ["reps"] },
  { name: "Plank", category: "bodyweight", metrics: ["duration"] },
];

export const DEFAULT_EXERCISES: DefaultExercise[] = [
  ...HYROX_STATIONS,
  ...DEFAULT_STRENGTH_EXERCISES,
];
