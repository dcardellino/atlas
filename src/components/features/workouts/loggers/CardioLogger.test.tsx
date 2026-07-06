import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ExercisePicker ruft createExercise auf — wird gemockt, damit kein Server-Action
// zur Laufzeit aufgerufen wird (auch wenn es in diesen Tests nicht ausgelöst wird).
const mocks = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock("@/lib/workouts/actions", () => ({
  createExercise: mocks.createExercise,
}));

import { CardioLogger } from "./CardioLogger";
import { TimeField } from "../TimeField";
import { emptyBlock, emptySet } from "@/lib/workouts/draft";
import type { WorkoutDraft } from "../useWorkoutDraft";

/**
 * Component-Tests für CardioLogger. Nutzt ein Mock-WorkoutDraft-Objekt
 * (Plain-Objekt mit vi.fn()-Mutatoren) für vollständige Isolation.
 */

function makeDraft(overrides: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    library: [],
    type: "cardio",
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
    metricsFor: () => [],
    buildInput: vi.fn(),
    buildStructure: vi.fn(),
    resetForType: vi.fn(),
    save: vi.fn(),
    saveTemplate: vi.fn(),
    doDelete: vi.fn(),
    ...overrides,
  } as WorkoutDraft;
}

// --- CardioLogger -----------------------------------------------------------

describe("CardioLogger", () => {
  it("rendert keine Ausgabe wenn blocks leer ist (Legacy: kein Block)", () => {
    const { container } = render(<CardioLogger draft={makeDraft()} />);
    expect(container.firstChild).toBeNull();
  });

  it("rendert Intervall-Zeilen des ersten Blocks (Distanz- und Dauer-Feld vorhanden)", () => {
    const s1 = { ...emptySet(), exercise_name: "Laufen" };
    const s2 = { ...emptySet(), exercise_name: "Radfahren" };
    const block = { ...emptyBlock("straight"), sets: [s1, s2] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    // Jedes Intervall hat einen Übungs-Picker (combobox) sowie Distanz- und Dauer-Feld
    expect(screen.getAllByRole("combobox", { name: "Übung" })).toHaveLength(2);
    expect(screen.getAllByLabelText("Distanz (m)")).toHaveLength(2);
    expect(screen.getAllByLabelText("Dauer (mm:ss)")).toHaveLength(2);
  });

  it("Pace-Berechnung korrekt: 5000 m in 25:00 → '5:00 /km'", () => {
    const set = {
      ...emptySet(),
      distance_m: "5000",
      duration_seconds: "1500",
    };
    const block = { ...emptyBlock("straight"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    expect(screen.getByLabelText("Pace")).toHaveTextContent("5:00 /km");
  });

  it("keine Pace wenn Distanz fehlt", () => {
    const set = { ...emptySet(), distance_m: "", duration_seconds: "1500" };
    const block = { ...emptyBlock("straight"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    expect(screen.queryByLabelText("Pace")).not.toBeInTheDocument();
  });

  it("keine Pace wenn Dauer fehlt", () => {
    const set = { ...emptySet(), distance_m: "5000", duration_seconds: "" };
    const block = { ...emptyBlock("straight"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    expect(screen.queryByLabelText("Pace")).not.toBeInTheDocument();
  });

  it('Dauer-Eingabe "25:00" schreibt duration_seconds: "1500" via patchSet', () => {
    const set = { ...emptySet(), key: "s1", duration_seconds: "" };
    const block = { ...emptyBlock("straight"), key: "b1", sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    fireEvent.change(screen.getByLabelText("Dauer (mm:ss)"), {
      target: { value: "25:00" },
    });

    expect(draft.patchSet).toHaveBeenCalledTimes(1);
    expect(draft.patchSet).toHaveBeenCalledWith("b1", "s1", {
      duration_seconds: "1500",
    });
  });

  it("Dauer Round-Trip: duration_seconds '1500' wird als '25:00' angezeigt", () => {
    const set = { ...emptySet(), duration_seconds: "1500" };
    const block = { ...emptyBlock("straight"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    expect(screen.getByLabelText("Dauer (mm:ss)")).toHaveValue("25:00");
  });

  it('"+ Intervall" ruft addSet(block.key) auf', () => {
    const block = { ...emptyBlock("straight"), key: "b1", sets: [] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    fireEvent.click(screen.getByRole("button", { name: "+ Intervall" }));

    expect(draft.addSet).toHaveBeenCalledTimes(1);
    expect(draft.addSet).toHaveBeenCalledWith("b1");
  });

  it('"✕" ruft removeSet mit block.key und set.key auf', () => {
    const s1 = { ...emptySet(), key: "s1" };
    const s2 = { ...emptySet(), key: "s2" };
    const block = { ...emptyBlock("straight"), key: "b1", sets: [s1, s2] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    // Erster „✕"-Button entfernt s1
    fireEvent.click(screen.getAllByRole("button", { name: "Intervall entfernen" })[0]);

    expect(draft.removeSet).toHaveBeenCalledTimes(1);
    expect(draft.removeSet).toHaveBeenCalledWith("b1", "s1");
  });

  it('"✕" ist deaktiviert, wenn nur ein Intervall existiert', () => {
    const set = { ...emptySet(), key: "s1" };
    const block = { ...emptyBlock("straight"), key: "b1", sets: [set] };
    const draft = makeDraft({ blocks: [block] });
    render(<CardioLogger draft={draft} />);

    expect(
      screen.getByRole("button", { name: "Intervall entfernen" }),
    ).toBeDisabled();
  });

  it("Legacy: Block mit 0 Sätzen rendert ohne Crash und zeigt '+ Intervall'", () => {
    const block = { ...emptyBlock("straight"), sets: [] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<CardioLogger draft={draft} />)).not.toThrow();
    expect(
      screen.getByRole("button", { name: "+ Intervall" }),
    ).toBeInTheDocument();
  });

  it("Legacy: Intervall ohne exercise_id (null) rendert ohne Crash", () => {
    const set = { ...emptySet(), exercise_id: null, exercise_name: "" };
    const block = { ...emptyBlock("straight"), sets: [set] };
    const draft = makeDraft({ blocks: [block] });

    expect(() => render(<CardioLogger draft={draft} />)).not.toThrow();
    expect(screen.getByRole("combobox", { name: "Übung" })).toBeInTheDocument();
  });

  it("Legacy: mehrere Blöcke → nimmt den ersten ohne Crash", () => {
    const b1 = { ...emptyBlock("straight"), key: "b1", sets: [] };
    const b2 = { ...emptyBlock("straight"), key: "b2", sets: [] };
    const draft = makeDraft({ blocks: [b1, b2] });

    expect(() => render(<CardioLogger draft={draft} />)).not.toThrow();
    // Nur ein „+ Intervall"-Button (für den ersten Block)
    expect(
      screen.getAllByRole("button", { name: "+ Intervall" }),
    ).toHaveLength(1);
  });
});

// --- TimeField (geteiltes Atom) -------------------------------------------

describe("TimeField", () => {
  it("zeigt mm:ss-Anzeige aus Sekunden-String (750 → '12:30')", () => {
    render(
      <TimeField value="750" onChange={vi.fn()} ariaLabel="Test-Zeit" />,
    );
    expect(screen.getByLabelText("Test-Zeit")).toHaveValue("12:30");
  });

  it("leerer value → leere Anzeige", () => {
    render(<TimeField value="" onChange={vi.fn()} ariaLabel="Test-Zeit" />);
    expect(screen.getByLabelText("Test-Zeit")).toHaveValue("");
  });

  it('Eingabe "12:30" gibt "750" via onChange zurück', () => {
    const onChange = vi.fn();
    render(<TimeField value="" onChange={onChange} ariaLabel="Test-Zeit" />);

    fireEvent.change(screen.getByLabelText("Test-Zeit"), {
      target: { value: "12:30" },
    });

    expect(onChange).toHaveBeenCalledWith("750");
  });

  it('ungültige Eingabe gibt "" via onChange zurück', () => {
    const onChange = vi.fn();
    render(<TimeField value="" onChange={onChange} ariaLabel="Test-Zeit" />);

    fireEvent.change(screen.getByLabelText("Test-Zeit"), {
      target: { value: "abc" },
    });

    expect(onChange).toHaveBeenCalledWith("");
  });
});
