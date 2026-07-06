import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ExercisePicker ruft createExercise auf — wird gemockt, damit kein Server-Action
// zur Laufzeit aufgerufen wird (auch wenn es in diesen Tests nicht ausgelöst wird).
const mocks = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock("@/lib/workouts/actions", () => ({
  createExercise: mocks.createExercise,
}));

import { BlockListLogger } from "./BlockListLogger";
import { emptyBlock } from "@/lib/workouts/draft";
import type { WorkoutDraft } from "../useWorkoutDraft";

/**
 * Component-Tests für BlockListLogger. Nutzt ein Mock-WorkoutDraft-Objekt
 * (Plain-Objekt mit vi.fn()-Mutatoren) für vollständige Isolation ohne
 * Server-Action-Mocks oder useWorkoutDraft-Wrapper.
 */

function makeDraft(overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    library: [],
    type: "wod",
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

describe("BlockListLogger", () => {
  it("renders all blocks from draft.blocks as Block-N headers", () => {
    const draft = makeDraft({
      blocks: [emptyBlock("straight"), emptyBlock("amrap")],
    });
    render(<BlockListLogger draft={draft} defaultMode="amrap" />);

    expect(screen.getByText("Block 1")).toBeInTheDocument();
    expect(screen.getByText("Block 2")).toBeInTheDocument();
  });

  it("renders the '+ Block hinzufügen' button", () => {
    render(<BlockListLogger draft={makeDraft()} defaultMode="amrap" />);
    expect(
      screen.getByRole("button", { name: /block hinzufügen/i }),
    ).toBeInTheDocument();
  });

  it("calls addBlock with defaultMode='amrap' when button is clicked (WOD)", () => {
    const draft = makeDraft();
    render(<BlockListLogger draft={draft} defaultMode="amrap" />);

    fireEvent.click(screen.getByRole("button", { name: /block hinzufügen/i }));

    expect(draft.addBlock).toHaveBeenCalledTimes(1);
    expect(draft.addBlock).toHaveBeenCalledWith("amrap");
  });

  it("calls addBlock with defaultMode='straight' when button is clicked (other)", () => {
    const draft = makeDraft({ type: "other" });
    render(<BlockListLogger draft={draft} defaultMode="straight" />);

    fireEvent.click(screen.getByRole("button", { name: /block hinzufügen/i }));

    expect(draft.addBlock).toHaveBeenCalledTimes(1);
    expect(draft.addBlock).toHaveBeenCalledWith("straight");
  });

  it("calls removeBlock with the correct key when block remove button is clicked", () => {
    const block = emptyBlock("straight");
    const draft = makeDraft({ blocks: [block] });
    render(<BlockListLogger draft={draft} defaultMode="straight" />);

    fireEvent.click(screen.getByRole("button", { name: "Block entfernen" }));

    expect(draft.removeBlock).toHaveBeenCalledTimes(1);
    expect(draft.removeBlock).toHaveBeenCalledWith(block.key);
  });

  it("renders an empty list and no block headers when blocks is empty", () => {
    render(<BlockListLogger draft={makeDraft()} defaultMode="straight" />);

    expect(screen.queryByText(/Block \d/)).not.toBeInTheDocument();
  });
});
