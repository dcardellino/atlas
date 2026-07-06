import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ExercisePicker ruft createExercise auf — wird gemockt, damit kein Server-Action
// zur Laufzeit aufgerufen wird.
const mocks = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock("@/lib/workouts/actions", () => ({
  createExercise: mocks.createExercise,
}));

import { StrengthLogger } from "./StrengthLogger";
import { emptyBlock, emptySet } from "@/lib/workouts/draft";
import type { WorkoutDraft } from "../useWorkoutDraft";
import type { Exercise } from "@/lib/workouts/types";

/**
 * Component-Tests für StrengthLogger. Nutzt ein Mock-WorkoutDraft-Objekt
 * (Plain-Objekt mit vi.fn()-Mutatoren) für vollständige Isolation ohne
 * Server-Action-Mocks oder useWorkoutDraft-Wrapper.
 */

function makeDraft(overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    library: [],
    type: "strength",
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
    metricsFor: () => ["reps", "weight"],
    buildInput: vi.fn(),
    buildStructure: vi.fn(),
    resetForType: vi.fn(),
    save: vi.fn(),
    saveTemplate: vi.fn(),
    doDelete: vi.fn(),
    ...overrides,
  } as WorkoutDraft;
}

describe("StrengthLogger", () => {
  it("renders one ExercisePicker (card header) per block", () => {
    const b1 = emptyBlock("straight");
    const b2 = emptyBlock("straight");
    const draft = makeDraft({ blocks: [b1, b2] });
    render(<StrengthLogger draft={draft} />);

    // Jede Karte hat genau einen Übungs-Picker im Kopf
    expect(screen.getAllByRole("combobox", { name: "Übung" })).toHaveLength(2);
  });

  it("renders no Modus dropdown (kein Modusselektor im Kraft-Layout)", () => {
    const draft = makeDraft({ blocks: [emptyBlock("straight")] });
    render(<StrengthLogger draft={draft} />);

    expect(screen.queryByLabelText("Modus")).not.toBeInTheDocument();
  });

  it("renders an RPE field for each set", () => {
    const block = emptyBlock("straight"); // 1 Satz
    const draft = makeDraft({ blocks: [block] });
    render(<StrengthLogger draft={draft} />);

    expect(screen.getByLabelText("RPE")).toBeInTheDocument();
  });

  it("calls patchSet with { rpe } when RPE field changes", () => {
    const block = emptyBlock("straight");
    const draft = makeDraft({ blocks: [block] });
    render(<StrengthLogger draft={draft} />);

    fireEvent.change(screen.getByLabelText("RPE"), { target: { value: "8" } });

    expect(draft.patchSet).toHaveBeenCalledTimes(1);
    expect(draft.patchSet).toHaveBeenCalledWith(block.key, block.sets[0].key, {
      rpe: "8",
    });
  });

  it("patches ALL sets of a block when exercise is selected in the card header", () => {
    const s1 = { ...emptySet(), key: "s1" };
    const s2 = { ...emptySet(), key: "s2" };
    const block = { ...emptyBlock("straight"), key: "b1", sets: [s1, s2] };
    const library: Exercise[] = [
      {
        id: "ex1",
        name: "Bench Press",
        category: "strength",
        metrics: ["reps", "weight"],
        is_default: false,
        archived_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const draft = makeDraft({ blocks: [block], library });
    render(<StrengthLogger draft={draft} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Übung" }), {
      target: { value: "ex1" },
    });

    expect(draft.patchBlock).toHaveBeenCalledTimes(1);
    const [bKey, patch] = (draft.patchBlock as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      { name: string; sets: Array<{ exercise_id: string; exercise_name: string }> },
    ];
    expect(bKey).toBe("b1");
    expect(patch.name).toBe("Bench Press");
    expect(patch.sets).toHaveLength(2);
    expect(patch.sets[0].exercise_id).toBe("ex1");
    expect(patch.sets[0].exercise_name).toBe("Bench Press");
    expect(patch.sets[1].exercise_id).toBe("ex1");
    expect(patch.sets[1].exercise_name).toBe("Bench Press");
  });

  it("calls addBlock('straight') when '+ Übung' is clicked", () => {
    const draft = makeDraft();
    render(<StrengthLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Übung" }));

    expect(draft.addBlock).toHaveBeenCalledTimes(1);
    expect(draft.addBlock).toHaveBeenCalledWith("straight");
  });

  it("calls addSet with the card exercise as seed when '+ Satz' is clicked", () => {
    const set = {
      ...emptySet(),
      exercise_id: "ex1",
      exercise_name: "Squat",
    };
    const block = { ...emptyBlock("straight"), key: "b1", sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<StrengthLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Satz" }));

    expect(draft.addSet).toHaveBeenCalledTimes(1);
    expect(draft.addSet).toHaveBeenCalledWith("b1", {
      exercise_id: "ex1",
      exercise_name: "Squat",
    });
  });

  it("calls removeBlock with the correct key when the remove button is clicked", () => {
    const block = { ...emptyBlock("straight"), key: "b1" };
    const draft = makeDraft({ blocks: [block] });
    render(<StrengthLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "Übung entfernen" }));

    expect(draft.removeBlock).toHaveBeenCalledTimes(1);
    expect(draft.removeBlock).toHaveBeenCalledWith("b1");
  });

  it("renders a legacy block with two sets of different exercises without crash", () => {
    // Legacy-Toleranz: Blöcke aus dem generischen Editor können Sätze mit
    // unterschiedlichen Übungen enthalten.
    const s1 = { ...emptySet(), exercise_id: "ex1", exercise_name: "Squat" };
    const s2 = { ...emptySet(), exercise_id: "ex2", exercise_name: "Bench Press" };
    const block = { ...emptyBlock("straight"), sets: [s1, s2] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<StrengthLogger draft={draft} />)).not.toThrow();
    // Beide Satz-Zeilen sind gerendert
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders an empty block (0 sets) with the picker and '+ Satz' button, no crash", () => {
    const block = { ...emptyBlock("straight"), sets: [] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<StrengthLogger draft={draft} />)).not.toThrow();
    expect(screen.getByRole("combobox", { name: "Übung" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Satz" })).toBeInTheDocument();
  });

  it("renders an empty block list with only the '+ Übung' button", () => {
    render(<StrengthLogger draft={makeDraft()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Übung" })).toBeInTheDocument();
  });
});
