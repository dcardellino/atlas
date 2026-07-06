/**
 * Reines Draft-Modell für den Workout-Logger: Typen, Hilfsfunktionen,
 * Block-/Set-Factories und Typ-spezifische Preset-Factories. Keine UI-Abhängigkeiten.
 */

import {
  HYROX_STATIONS,
  type BlockInput,
  type Exercise,
  type SetInput,
  type TemplateBlock,
  type WorkoutDetail,
  type WorkoutMode,
  type WorkoutType,
} from "@/lib/workouts/types";

// --- Editier-Modelle (Zahlen als Strings für die Eingabe) --------------------

export type SetDraft = {
  key: string;
  exercise_id: string | null;
  exercise_name: string;
  reps: string;
  weight_kg: string;
  distance_m: string;
  duration_seconds: string;
  calories: string;
  rpe: string;
  is_warmup: boolean;
};

export type BlockDraft = {
  key: string;
  mode: WorkoutMode;
  name: string;
  duration_seconds: string; // Sekunden als String
  interval_seconds: string;
  rest_seconds: string;
  rounds: string;
  result_rounds: string;
  result_reps: string;
  result_seconds: string;
  sets: SetDraft[];
};

// --- UID-Generator -----------------------------------------------------------

let counter = 0;
export const uid = () => `k${counter++}`;

// --- String-Konverter --------------------------------------------------------

export function toInt(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function toNum(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// mm:ss ODER reine Sekunden → Sekunden.
export function parseTime(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  if (t.includes(":")) {
    const [m, s] = t.split(":");
    const mm = Number(m);
    const ss = Number(s);
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
    return mm * 60 + ss;
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function formatTime(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Lokales Datum (yyyy-MM-dd) ohne UTC-Verschiebung.
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// --- Basis-Factories ---------------------------------------------------------

export function emptySet(): SetDraft {
  return {
    key: uid(),
    exercise_id: null,
    exercise_name: "",
    reps: "",
    weight_kg: "",
    distance_m: "",
    duration_seconds: "",
    calories: "",
    rpe: "",
    is_warmup: false,
  };
}

export function emptyBlock(mode: WorkoutMode = "straight"): BlockDraft {
  const base: BlockDraft = {
    key: uid(),
    mode,
    name: "",
    duration_seconds: "",
    interval_seconds: "",
    rest_seconds: "",
    rounds: "",
    result_rounds: "",
    result_reps: "",
    result_seconds: "",
    sets: [emptySet()],
  };
  if (mode === "emom") base.interval_seconds = "60";
  if (mode === "tabata") {
    base.interval_seconds = "20";
    base.rest_seconds = "10";
    base.rounds = "8";
  }
  return base;
}

/** Bestehende WorkoutDetail → bearbeitbare BlockDraft-Liste. */
export function detailToBlocks(detail: WorkoutDetail): BlockDraft[] {
  return detail.blocks.map((b) => ({
    key: uid(),
    mode: b.mode,
    name: b.name ?? "",
    duration_seconds: b.duration_seconds?.toString() ?? "",
    interval_seconds: b.interval_seconds?.toString() ?? "",
    rest_seconds: b.rest_seconds?.toString() ?? "",
    rounds: b.rounds?.toString() ?? "",
    result_rounds: b.result_rounds?.toString() ?? "",
    result_reps: b.result_reps?.toString() ?? "",
    result_seconds: formatTime(b.result_seconds),
    sets:
      b.sets.length > 0
        ? b.sets.map((s) => ({
            key: uid(),
            exercise_id: s.exercise_id,
            exercise_name: s.exercise_name,
            reps: s.reps?.toString() ?? "",
            weight_kg: s.weight_kg?.toString() ?? "",
            distance_m: s.distance_m?.toString() ?? "",
            duration_seconds: s.duration_seconds?.toString() ?? "",
            calories: s.calories?.toString() ?? "",
            rpe: s.rpe?.toString() ?? "",
            is_warmup: s.is_warmup,
          }))
        : [emptySet()],
  }));
}

// --- Mapping-Kerne (pure Konvertierung BlockDraft → Payload) -----------------

/** Wandelt Draft-Blöcke in BlockInput-Payload um (für createWorkout/updateWorkout). */
export function blocksToInput(blocks: BlockDraft[]): BlockInput[] {
  return blocks.map((b) => {
    const sets: SetInput[] = b.sets
      .filter((s) => s.exercise_name.trim() !== "")
      .map((s) => ({
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name.trim(),
        reps: toInt(s.reps),
        weight_kg: toNum(s.weight_kg),
        distance_m: toInt(s.distance_m),
        duration_seconds: toInt(s.duration_seconds),
        calories: toInt(s.calories),
        rpe: toNum(s.rpe),
        is_warmup: s.is_warmup,
      }));
    return {
      mode: b.mode,
      name: b.name.trim() || null,
      duration_seconds: toInt(b.duration_seconds),
      interval_seconds: toInt(b.interval_seconds),
      rest_seconds: toInt(b.rest_seconds),
      rounds: toInt(b.rounds),
      result_rounds: toInt(b.result_rounds),
      result_reps: toInt(b.result_reps),
      result_seconds: parseTime(b.result_seconds),
      sets,
    };
  });
}

/** Wandelt Draft-Blöcke in TemplateBlock-Struktur um (ohne Ergebnisfelder). */
export function blocksToStructure(blocks: BlockDraft[]): TemplateBlock[] {
  return blocks.map((b) => ({
    mode: b.mode,
    name: b.name.trim() || null,
    duration_seconds: toInt(b.duration_seconds),
    interval_seconds: toInt(b.interval_seconds),
    rest_seconds: toInt(b.rest_seconds),
    rounds: toInt(b.rounds),
    sets: b.sets
      .filter((s) => s.exercise_name.trim() !== "")
      .map((s) => ({
        exercise_id: s.exercise_id,
        exercise_name: s.exercise_name.trim(),
        reps: toInt(s.reps),
        weight_kg: toNum(s.weight_kg),
        distance_m: toInt(s.distance_m),
        duration_seconds: toInt(s.duration_seconds),
        calories: toInt(s.calories),
        is_warmup: s.is_warmup,
      })),
  }));
}

// --- Typ-spezifische Struktur-Factories --------------------------------------

/**
 * Kraft-Block für eine einzelne Übung. Ohne Übung: leerer straight-Block
 * (identisch zu emptyBlock("straight")). Mit Übung: Block mit einem Satz,
 * der auf die Übung vorbefüllt ist.
 */
export function exerciseBlock(ex?: Exercise): BlockDraft {
  if (!ex) return emptyBlock("straight");
  return {
    key: uid(),
    mode: "straight",
    name: ex.name,
    duration_seconds: "",
    interval_seconds: "",
    rest_seconds: "",
    rounds: "",
    result_rounds: "",
    result_reps: "",
    result_seconds: "",
    sets: [
      {
        key: uid(),
        exercise_id: ex.id,
        exercise_name: ex.name,
        reps: "",
        weight_kg: "",
        distance_m: "",
        duration_seconds: "",
        calories: "",
        rpe: "",
        is_warmup: false,
      },
    ],
  };
}

/**
 * Hyrox-Preset: genau 1 for_time-Block mit 16 Sätzen in der Standard-Rennreihenfolge
 * (Lauf, Station1, Lauf, Station2, …, Lauf, Station8). exercise_id wird aus der
 * Library aufgelöst — fehlt eine Übung, bleibt exercise_id null (Preset funktioniert
 * auch ohne vollständige Library).
 */
export function hyroxPresetBlocks(library: Exercise[]): BlockDraft[] {
  // Lauf (index 0) + die 8 Stationen (index 1–8) aus HYROX_STATIONS
  const laufName = HYROX_STATIONS[0].name;
  const stations = HYROX_STATIONS.slice(1);

  const sets: SetDraft[] = [];
  for (const station of stations) {
    // Lauf-Leg vor jeder Station
    sets.push({
      key: uid(),
      exercise_id: library.find((e) => e.name === laufName)?.id ?? null,
      exercise_name: laufName,
      reps: "",
      weight_kg: "",
      distance_m: "",
      duration_seconds: "",
      calories: "",
      rpe: "",
      is_warmup: false,
    });
    // Station
    sets.push({
      key: uid(),
      exercise_id: library.find((e) => e.name === station.name)?.id ?? null,
      exercise_name: station.name,
      reps: "",
      weight_kg: "",
      distance_m: "",
      duration_seconds: "",
      calories: "",
      rpe: "",
      is_warmup: false,
    });
  }

  return [
    {
      key: uid(),
      mode: "for_time",
      name: "",
      duration_seconds: "",
      interval_seconds: "",
      rest_seconds: "",
      rounds: "",
      result_rounds: "",
      result_reps: "",
      result_seconds: "",
      sets,
    },
  ];
}

/** Cardio-Block: benannte Factory für einen leeren straight-Block. */
export function cardioBlock(): BlockDraft {
  return emptyBlock("straight");
}

/** Liefert die passende Startkonfiguration je Workout-Typ. */
export function defaultBlocksForType(
  type: WorkoutType,
  library: Exercise[],
): BlockDraft[] {
  switch (type) {
    case "strength":
      return [exerciseBlock()];
    case "hyrox":
      return hyroxPresetBlocks(library);
    case "wod":
      return [emptyBlock("amrap")];
    case "cardio":
      return [cardioBlock()];
    case "other":
      return [emptyBlock("straight")];
  }
}

/**
 * Prüft ob der Nutzer echte Eingaben gemacht hat. Bewertet nur Metrik-/Ergebnis-
 * werte — exercise_name allein (z. B. im Hyrox-Preset) gilt NICHT als dirty.
 */
export function isDraftDirty(blocks: BlockDraft[]): boolean {
  for (const block of blocks) {
    if (block.result_rounds.trim() !== "") return true;
    if (block.result_reps.trim() !== "") return true;
    if (block.result_seconds.trim() !== "") return true;
    for (const set of block.sets) {
      if (set.reps.trim() !== "") return true;
      if (set.weight_kg.trim() !== "") return true;
      if (set.distance_m.trim() !== "") return true;
      if (set.duration_seconds.trim() !== "") return true;
      if (set.calories.trim() !== "") return true;
    }
  }
  return false;
}
