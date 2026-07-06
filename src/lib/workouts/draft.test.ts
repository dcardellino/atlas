import { describe, expect, it } from "vitest";
import {
  parseTime,
  formatTime,
  emptyBlock,
  exerciseBlock,
  hyroxPresetBlocks,
  cardioBlock,
  defaultBlocksForType,
  isDraftDirty,
  blocksToInput,
  detailToBlocks,
} from "./draft";
import type { BlockDraft } from "./draft";
import type { Exercise, WorkoutDetail } from "./types";

// --- Hilfsfunktionen zur Testerstellung -------------------------------------

function makeExercise(partial: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    category: "strength",
    metrics: ["reps", "weight"],
    is_default: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function makeLibrary(): Exercise[] {
  return [
    makeExercise({ id: "lauf-id", name: "Lauf (1 km)", category: "hyrox", metrics: ["distance", "duration"] }),
    makeExercise({ id: "ski-id", name: "SkiErg", category: "hyrox", metrics: ["distance", "duration", "calories"] }),
    makeExercise({ id: "sledpush-id", name: "Sled Push", category: "hyrox", metrics: ["distance", "weight", "duration"] }),
    makeExercise({ id: "sledpull-id", name: "Sled Pull", category: "hyrox", metrics: ["distance", "weight", "duration"] }),
    makeExercise({ id: "burpee-id", name: "Burpee Broad Jumps", category: "hyrox", metrics: ["distance", "duration"] }),
    makeExercise({ id: "rudern-id", name: "Rudern", category: "hyrox", metrics: ["distance", "duration", "calories"] }),
    makeExercise({ id: "farmers-id", name: "Farmers Carry", category: "hyrox", metrics: ["distance", "weight", "duration"] }),
    makeExercise({ id: "sandbag-id", name: "Sandbag Lunges", category: "hyrox", metrics: ["distance", "weight", "duration"] }),
    makeExercise({ id: "wallballs-id", name: "Wall Balls", category: "hyrox", metrics: ["reps", "weight", "duration"] }),
  ];
}

// --- parseTime --------------------------------------------------------------

describe("parseTime", () => {
  it('konvertiert "12:30" → 750', () => {
    expect(parseTime("12:30")).toBe(750);
  });

  it('konvertiert "1:05" → 65', () => {
    expect(parseTime("1:05")).toBe(65);
  });

  it('konvertiert reine Sekunden "90" → 90', () => {
    expect(parseTime("90")).toBe(90);
  });

  it('konvertiert leeren String "" → null', () => {
    expect(parseTime("")).toBeNull();
  });
});

// --- formatTime -------------------------------------------------------------

describe("formatTime", () => {
  it("formatiert 750 → 12:30", () => {
    expect(formatTime(750)).toBe("12:30");
  });

  it("formatiert 65 → 1:05", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formatiert null → leerer String", () => {
    expect(formatTime(null)).toBe("");
  });
});

// --- hyroxPresetBlocks ------------------------------------------------------

describe("hyroxPresetBlocks", () => {
  it("gibt genau 1 Block zurück", () => {
    expect(hyroxPresetBlocks([])).toHaveLength(1);
  });

  it('Block hat mode "for_time"', () => {
    const [block] = hyroxPresetBlocks([]);
    expect(block.mode).toBe("for_time");
  });

  it("Block hat genau 16 Sätze", () => {
    const [block] = hyroxPresetBlocks([]);
    expect(block.sets).toHaveLength(16);
  });

  it('Positionen 0, 2, 4, …, 14 haben exercise_name "Lauf (1 km)"', () => {
    const [block] = hyroxPresetBlocks([]);
    for (let i = 0; i <= 14; i += 2) {
      expect(block.sets[i].exercise_name).toBe("Lauf (1 km)");
    }
  });

  it('Position 1 hat exercise_name "SkiErg"', () => {
    const [block] = hyroxPresetBlocks([]);
    expect(block.sets[1].exercise_name).toBe("SkiErg");
  });

  it('Position 15 hat exercise_name "Wall Balls"', () => {
    const [block] = hyroxPresetBlocks([]);
    expect(block.sets[15].exercise_name).toBe("Wall Balls");
  });

  it("setzt exercise_id wenn Übung in der Library vorhanden", () => {
    const lib = makeLibrary();
    const [block] = hyroxPresetBlocks(lib);
    expect(block.sets[0].exercise_id).toBe("lauf-id");
    expect(block.sets[1].exercise_id).toBe("ski-id");
    expect(block.sets[15].exercise_id).toBe("wallballs-id");
  });

  it("setzt exercise_id auf null bei leerer Library", () => {
    const [block] = hyroxPresetBlocks([]);
    for (const set of block.sets) {
      expect(set.exercise_id).toBeNull();
    }
  });
});

// --- exerciseBlock ----------------------------------------------------------

describe("exerciseBlock", () => {
  it("ohne Argument: straight-Block mit einem leeren Satz", () => {
    const block: BlockDraft = exerciseBlock();
    expect(block.mode).toBe("straight");
    expect(block.sets).toHaveLength(1);
    expect(block.sets[0].exercise_name).toBe("");
    expect(block.sets[0].exercise_id).toBeNull();
  });

  it("mit Exercise: Block-Name + Satz auf die Übung vorbefüllt", () => {
    const ex = makeExercise({ id: "squat-id", name: "Kniebeuge" });
    const block: BlockDraft = exerciseBlock(ex);
    expect(block.mode).toBe("straight");
    expect(block.name).toBe("Kniebeuge");
    expect(block.sets).toHaveLength(1);
    expect(block.sets[0].exercise_id).toBe("squat-id");
    expect(block.sets[0].exercise_name).toBe("Kniebeuge");
  });
});

// --- cardioBlock ------------------------------------------------------------

describe("cardioBlock", () => {
  it("gibt einen straight-Block mit einem leeren Satz zurück", () => {
    const block: BlockDraft = cardioBlock();
    expect(block.mode).toBe("straight");
    expect(block.sets).toHaveLength(1);
    expect(block.sets[0].exercise_name).toBe("");
  });
});

// --- defaultBlocksForType ---------------------------------------------------

describe("defaultBlocksForType", () => {
  it('strength → 1 straight-Block', () => {
    const blocks = defaultBlocksForType("strength", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("straight");
  });

  it('hyrox → 16 Sätze in einem for_time-Block', () => {
    const blocks = defaultBlocksForType("hyrox", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("for_time");
    expect(blocks[0].sets).toHaveLength(16);
  });

  it('wod → 1 amrap-Block', () => {
    const blocks = defaultBlocksForType("wod", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("amrap");
  });

  it('cardio → 1 straight-Block', () => {
    const blocks = defaultBlocksForType("cardio", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("straight");
  });

  it('other → 1 straight-Block', () => {
    const blocks = defaultBlocksForType("other", []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].mode).toBe("straight");
  });
});

// --- isDraftDirty -----------------------------------------------------------

describe("isDraftDirty", () => {
  it("frische defaultBlocksForType(strength) sind nicht dirty", () => {
    expect(isDraftDirty(defaultBlocksForType("strength", []))).toBe(false);
  });

  it("frische defaultBlocksForType(hyrox) sind nicht dirty (Hyrox-Preset)", () => {
    expect(isDraftDirty(defaultBlocksForType("hyrox", makeLibrary()))).toBe(false);
  });

  it("frische defaultBlocksForType(wod) sind nicht dirty", () => {
    expect(isDraftDirty(defaultBlocksForType("wod", []))).toBe(false);
  });

  it("frische defaultBlocksForType(cardio) sind nicht dirty", () => {
    expect(isDraftDirty(defaultBlocksForType("cardio", []))).toBe(false);
  });

  it("frische defaultBlocksForType(other) sind nicht dirty", () => {
    expect(isDraftDirty(defaultBlocksForType("other", []))).toBe(false);
  });

  it("wird dirty wenn ein Satz reps eingetragen hat", () => {
    const blocks = defaultBlocksForType("strength", []);
    blocks[0].sets[0].reps = "5";
    expect(isDraftDirty(blocks)).toBe(true);
  });

  it("wird dirty wenn ein Satz duration_seconds eingetragen hat", () => {
    const blocks = defaultBlocksForType("wod", []);
    blocks[0].sets[0].duration_seconds = "60";
    expect(isDraftDirty(blocks)).toBe(true);
  });

  it("wird dirty wenn ein Block result_seconds eingetragen hat", () => {
    const blocks = defaultBlocksForType("hyrox", makeLibrary());
    blocks[0].result_seconds = "45:00";
    expect(isDraftDirty(blocks)).toBe(true);
  });

  it("exercise_name allein macht den Block nicht dirty", () => {
    // Satz mit exercise_name aber ohne Metrikwerte → nicht dirty
    const block = emptyBlock("straight");
    block.sets[0].exercise_name = "Kniebeuge";
    expect(isDraftDirty([block])).toBe(false);
  });

  it("wird dirty wenn ein Satz nur rpe eingetragen hat", () => {
    const blocks = defaultBlocksForType("strength", []);
    blocks[0].sets[0].rpe = "8";
    expect(isDraftDirty(blocks)).toBe(true);
  });

  it("frische defaultBlocksForType(hyrox) bleiben nicht dirty nach Hinzufügen des rpe-Checks (Preset hat rpe: '')", () => {
    // Alle Sätze im Hyrox-Preset haben rpe: "" → isDraftDirty muss false zurückgeben
    expect(isDraftDirty(defaultBlocksForType("hyrox", makeLibrary()))).toBe(false);
  });
});

// --- blocksToInput ----------------------------------------------------------

describe("blocksToInput", () => {
  it("filtert Sätze ohne exercise_name heraus", () => {
    const block = emptyBlock("straight");
    // block hat einen leeren Satz → soll herausgefiltert werden
    const input = blocksToInput([block]);
    expect(input[0].sets).toHaveLength(0);
  });

  it("konvertiert Strings korrekt und behält befüllte Sätze", () => {
    const block = emptyBlock("straight");
    block.sets[0] = {
      ...block.sets[0],
      exercise_name: "Kniebeuge",
      exercise_id: "ex-1",
      reps: "5",
      weight_kg: "100,5",
      distance_m: "",
      duration_seconds: "",
      calories: "",
      is_warmup: false,
    };
    const input = blocksToInput([block]);
    expect(input[0].sets).toHaveLength(1);
    const set = input[0].sets[0];
    expect(set.exercise_name).toBe("Kniebeuge");
    expect(set.exercise_id).toBe("ex-1");
    expect(set.reps).toBe(5);
    expect(set.weight_kg).toBeCloseTo(100.5);
    expect(set.distance_m).toBeNull();
    expect(set.duration_seconds).toBeNull();
    expect(set.calories).toBeNull();
  });

  it('reicht rpe als Dezimalzahl durch: "7.5" → 7.5', () => {
    const block = emptyBlock("straight");
    block.sets[0] = { ...block.sets[0], exercise_name: "Kniebeuge", rpe: "7.5" };
    const input = blocksToInput([block]);
    expect(input[0].sets[0].rpe).toBe(7.5);
  });

  it("reicht leeres rpe als null durch", () => {
    const block = emptyBlock("straight");
    block.sets[0] = { ...block.sets[0], exercise_name: "Kniebeuge", rpe: "" };
    const input = blocksToInput([block]);
    expect(input[0].sets[0].rpe).toBeNull();
  });

  it('parst duration_seconds als mm:ss: "12:30" → 750 (Hyrox-Split)', () => {
    const block = emptyBlock("for_time");
    block.sets[0] = { ...block.sets[0], exercise_name: "SkiErg", duration_seconds: "12:30" };
    const input = blocksToInput([block]);
    expect(input[0].sets[0].duration_seconds).toBe(750);
  });

  it('parst duration_seconds als Sekunden: "90" → 90 (abwärtskompatibel, WOD/other "Sek.")', () => {
    const block = emptyBlock("straight");
    block.sets[0] = { ...block.sets[0], exercise_name: "Plank", duration_seconds: "90" };
    const input = blocksToInput([block]);
    expect(input[0].sets[0].duration_seconds).toBe(90);
  });
});

// --- detailToBlocks (rpe Round-Trip) -----------------------------------------

describe("detailToBlocks (rpe)", () => {
  function makeDetail(rpe: number | null): WorkoutDetail {
    return {
      id: "w1",
      area_id: null,
      title: null,
      type: "strength",
      performed_on: "2026-07-06",
      notes: null,
      perceived_effort: null,
      total_duration_seconds: null,
      template_id: null,
      created_at: "2026-07-06T00:00:00Z",
      updated_at: "2026-07-06T00:00:00Z",
      blocks: [
        {
          id: "b1",
          workout_id: "w1",
          mode: "straight",
          name: null,
          position: 0,
          duration_seconds: null,
          interval_seconds: null,
          rest_seconds: null,
          rounds: null,
          result_rounds: null,
          result_reps: null,
          result_seconds: null,
          notes: null,
          created_at: "2026-07-06T00:00:00Z",
          sets: [
            {
              id: "s1",
              workout_id: "w1",
              block_id: "b1",
              exercise_id: "e1",
              exercise_name: "Kniebeuge",
              position: 0,
              set_number: 1,
              reps: 5,
              weight_kg: 100,
              distance_m: null,
              duration_seconds: null,
              calories: null,
              rpe,
              is_warmup: false,
              created_at: "2026-07-06T00:00:00Z",
            },
          ],
        },
      ],
    };
  }

  it('liest rpe 7.5 aus der DB-Row und gibt "7.5" als String zurück', () => {
    const blocks = detailToBlocks(makeDetail(7.5));
    expect(blocks[0].sets[0].rpe).toBe("7.5");
  });

  it("liest rpe null aus der DB-Row und gibt leeren String zurück", () => {
    const blocks = detailToBlocks(makeDetail(null));
    expect(blocks[0].sets[0].rpe).toBe("");
  });
});
