import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ExercisePicker ruft createExercise auf — wird gemockt, damit kein Server-Action
// zur Laufzeit aufgerufen wird (auch wenn es in diesen Tests nicht ausgelöst wird).
const mocks = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock("@/lib/workouts/actions", () => ({
  createExercise: mocks.createExercise,
}));

import { HyroxLogger } from "./HyroxLogger";
import { emptyBlock, emptySet } from "@/lib/workouts/draft";
import type { WorkoutDraft } from "../useWorkoutDraft";
import type { SetMetric } from "@/lib/workouts/types";

/**
 * Component-Tests für HyroxLogger. Nutzt ein Mock-WorkoutDraft-Objekt
 * (Plain-Objekt mit vi.fn()-Mutatoren) für vollständige Isolation ohne
 * Server-Action-Mocks oder useWorkoutDraft-Wrapper.
 */

function makeDraft(overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    library: [],
    type: "hyrox",
    performedOn: "2026-01-01",
    title: "",
    effort: "",
    notes: "",
    blocks: [],
    errors: null,
    pending: false,
    exerciseById: new Map(),
    isDirty: false,
    isEditing: false,
    setType: vi.fn(),
    setPerformedOn: vi.fn(),
    setTitle: vi.fn(),
    setEffort: vi.fn(),
    setNotes: vi.fn(),
    onExerciseCreated: vi.fn(),
    patchBlock: vi.fn(),
    patchSet: vi.fn(),
    addBlock: vi.fn(),
    removeBlock: vi.fn(),
    addSet: vi.fn(),
    removeSet: vi.fn(),
    // Standard-Hyrox-Metriken: Distanz + Split-Zeit + optional Kalorien
    metricsFor: (): SetMetric[] => ["distance", "duration"],
    buildInput: vi.fn(),
    buildStructure: vi.fn(),
    resetForType: vi.fn(),
    save: vi.fn(),
    saveTemplate: vi.fn(),
    doDelete: vi.fn(),
    ...overrides,
  } as WorkoutDraft;
}

describe("HyroxLogger", () => {
  it("rendert keine Ausgabe wenn blocks leer ist (Legacy: kein Block)", () => {
    const { container } = render(<HyroxLogger draft={makeDraft()} />);
    expect(container.firstChild).toBeNull();
  });

  it("rendert die Segment-Zeilen des ersten Blocks (Übungs-Picker + Split-Felder)", () => {
    const s1 = { ...emptySet(), exercise_name: "Lauf (1 km)" };
    const s2 = { ...emptySet(), exercise_name: "SkiErg" };
    const block = { ...emptyBlock("for_time"), sets: [s1, s2] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    // Jedes Segment hat einen Übungs-Picker (combobox) und ein Split-Feld
    expect(screen.getAllByRole("combobox", { name: "Übung" })).toHaveLength(2);
    expect(screen.getAllByLabelText("Split (mm:ss)")).toHaveLength(2);
  });

  it('Split-Eingabe "12:30" schreibt duration_seconds: "750" (Sekunden) via patchSet', () => {
    const set = { ...emptySet(), key: "s1", duration_seconds: "" };
    const block = { ...emptyBlock("for_time"), key: "b1", sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    fireEvent.change(screen.getByLabelText("Split (mm:ss)"), {
      target: { value: "12:30" },
    });

    expect(draft.patchSet).toHaveBeenCalledTimes(1);
    expect(draft.patchSet).toHaveBeenCalledWith("b1", "s1", {
      duration_seconds: "750",
    });
  });

  it("Gesamtzeit-Eingabe schreibt result_seconds via patchBlock", () => {
    const block = { ...emptyBlock("for_time"), key: "b1", sets: [] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    fireEvent.change(screen.getByLabelText("Gesamtzeit (mm:ss)"), {
      target: { value: "45:30" },
    });

    expect(draft.patchBlock).toHaveBeenCalledTimes(1);
    expect(draft.patchBlock).toHaveBeenCalledWith("b1", {
      result_seconds: "45:30",
    });
  });

  it('"+ Segment" ruft addSet(block.key) auf', () => {
    const block = { ...emptyBlock("for_time"), key: "b1", sets: [] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Segment" }));

    expect(draft.addSet).toHaveBeenCalledTimes(1);
    expect(draft.addSet).toHaveBeenCalledWith("b1");
  });

  it('"✕" ruft removeSet mit block.key und set.key auf', () => {
    const set = { ...emptySet(), key: "s1" };
    const block = { ...emptyBlock("for_time"), key: "b1", sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "Segment entfernen" }));

    expect(draft.removeSet).toHaveBeenCalledTimes(1);
    expect(draft.removeSet).toHaveBeenCalledWith("b1", "s1");
  });

  it("Split-Round-Trip: duration_seconds 750 wird als '12:30' angezeigt", () => {
    const set = { ...emptySet(), duration_seconds: "750" };
    const block = { ...emptyBlock("for_time"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<HyroxLogger draft={draft} />);

    // Gespeicherte Sekunden werden im lokalen State als mm:ss initialisiert
    expect(screen.getByLabelText("Split (mm:ss)")).toHaveValue("12:30");
  });

  it("Legacy: Block mit 0 Sätzen rendert ohne Crash und zeigt '+ Segment'", () => {
    const block = { ...emptyBlock("for_time"), sets: [] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<HyroxLogger draft={draft} />)).not.toThrow();
    expect(screen.getByRole("button", { name: "+ Segment" })).toBeInTheDocument();
  });

  it("Legacy: Segment ohne exercise_id (null) rendert ohne Crash", () => {
    const set = { ...emptySet(), exercise_id: null, exercise_name: "" };
    const block = { ...emptyBlock("for_time"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<HyroxLogger draft={draft} />)).not.toThrow();
    expect(screen.getByRole("combobox", { name: "Übung" })).toBeInTheDocument();
  });

  it("Legacy: mehrere Blöcke → nimmt den ersten ohne Crash", () => {
    const b1 = { ...emptyBlock("for_time"), key: "b1", sets: [] };
    const b2 = { ...emptyBlock("for_time"), key: "b2", sets: [] };
    const draft = makeDraft({ blocks: [b1, b2] });

    expect(() => render(<HyroxLogger draft={draft} />)).not.toThrow();
    // Nur ein Gesamtzeit-Feld (für ersten Block)
    expect(screen.getAllByLabelText("Gesamtzeit (mm:ss)")).toHaveLength(1);
  });

  it("Stationsmetriken (ohne duration) werden als Felder gerendert", () => {
    // Metrik-Mix: distance + weight + duration — HyroxLogger zeigt distance + weight, nicht duration
    const set = { ...emptySet(), exercise_name: "Sled Push" };
    const block = { ...emptyBlock("for_time"), sets: [set] };
    const draft = makeDraft({
      blocks: [block],
      metricsFor: (): SetMetric[] => ["distance", "weight", "duration"],
    });
    render(<HyroxLogger draft={draft} />);

    // Split-Feld (mm:ss) ist vorhanden
    expect(screen.getByLabelText("Split (mm:ss)")).toBeInTheDocument();
    // Stationsmetriken "m" (distance) und "kg" (weight) sind vorhanden
    expect(screen.getByLabelText("m")).toBeInTheDocument();
    expect(screen.getByLabelText("kg")).toBeInTheDocument();
    // "Sek." (duration als Stationsmetrik) ist NICHT vorhanden — die Produktion-
    // filter (.filter((m) => m !== "duration")) hält sie raus. Würde man diesen
    // Filter entfernen, würde das Label "Sek." gerendert und diese Assertion schlägt fehl.
    expect(screen.queryByLabelText("Sek.")).not.toBeInTheDocument();
  });
});
