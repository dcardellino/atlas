import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks (hoisted, damit vi.mock-Factories darauf zugreifen können) -------
const mocks = vi.hoisted(() => ({
  createWorkout: vi.fn(),
  updateWorkout: vi.fn(),
  removeWorkout: vi.fn(),
  createTemplate: vi.fn(),
  createExercise: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}));

vi.mock("@/lib/workouts/actions", () => ({
  createWorkout: mocks.createWorkout,
  updateWorkout: mocks.updateWorkout,
  removeWorkout: mocks.removeWorkout,
  createTemplate: mocks.createTemplate,
  createExercise: mocks.createExercise,
}));

// useToast benötigt ToastProvider — wird vollständig gemockt, damit kein
// Context-Provider in den Tests mitgeführt werden muss.
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ show: mocks.showToast }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import WorkoutLogger from "./WorkoutLogger";
import type { WorkoutDetail } from "@/lib/workouts/types";

// Minimales WorkoutDetail-Objekt für Bearbeiten-Modus-Tests
const mockWorkout: WorkoutDetail = {
  id: "w1",
  area_id: null,
  title: null,
  type: "strength",
  performed_on: "2026-01-01",
  notes: null,
  perceived_effort: null,
  total_duration_seconds: null,
  template_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  blocks: [],
};

// ---------------------------------------------------------------------------

describe("WorkoutLogger — typspezifischer Body", () => {
  beforeEach(() => vi.clearAllMocks());

  it('Typ "strength" (Standard) zeigt RPE-Feld (StrengthLogger-Marker)', () => {
    render(<WorkoutLogger exercises={[]} />);
    // StrengthSetRow rendert aria-label="RPE" — kein anderes Body hat das
    expect(screen.getByLabelText("RPE")).toBeInTheDocument();
  });

  it('Typ "hyrox" zeigt Gesamtzeit-Feld (HyroxLogger-Marker)', () => {
    render(<WorkoutLogger exercises={[]} />);
    // Sauberer Wechsel: isDirty=false → sofort resetForType, kein Dialog
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "hyrox" } });
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    // HyroxLogger rendert aria-label="Gesamtzeit (mm:ss)"
    expect(screen.getByLabelText("Gesamtzeit (mm:ss)")).toBeInTheDocument();
  });

  it('Typ "cardio" zeigt Distanz-Feld (CardioLogger-Marker)', () => {
    render(<WorkoutLogger exercises={[]} />);
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "cardio" } });
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    // CardioLogger-IntervalRow rendert aria-label="Distanz (m)"
    expect(screen.getByLabelText("Distanz (m)")).toBeInTheDocument();
  });

  it('Typ "wod" zeigt amrap-Modus-Config (BlockListLogger-Marker)', () => {
    render(<WorkoutLogger exercises={[]} />);
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "wod" } });
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    // BlockListLogger(amrap) → ModeConfig rendert "Cap (Sek.)" für amrap
    expect(screen.getByLabelText("Cap (Sek.)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe("WorkoutLogger — Typwechsel-Flow mit Reset-Rückfrage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sauberer Wechsel springt direkt auf neuen Body (kein Dialog)", () => {
    render(<WorkoutLogger exercises={[]} />);
    // Kein Wert eingegeben → isDirty=false
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "cardio" } });
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Distanz (m)")).toBeInTheDocument();
  });

  it("dirty Wechsel öffnet ConfirmDialog mit richtigem Titel", () => {
    render(<WorkoutLogger exercises={[]} />);
    // Draft dirty machen: Wdh.-Feld des ersten Satzes (reps) ändern
    fireEvent.change(screen.getByLabelText("Wdh."), { target: { value: "10" } });
    // Typ wechseln → Dialog erscheint
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "hyrox" } });
    expect(screen.getByText("Typ wechseln?")).toBeInTheDocument();
    expect(
      screen.getByText("Die aktuelle Erfassung wird zurückgesetzt."),
    ).toBeInTheDocument();
  });

  it('Bestätigen im Dialog wechselt Typ und zeigt neuen Body (isDirty reset)', () => {
    render(<WorkoutLogger exercises={[]} />);
    // Draft dirty machen
    fireEvent.change(screen.getByLabelText("Wdh."), { target: { value: "5" } });
    // Typ wechseln → Dialog erscheint
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "cardio" } });
    expect(screen.getByText("Typ wechseln?")).toBeInTheDocument();
    // "Wechseln" klicken → resetForType → neuer Body, Dialog weg
    fireEvent.click(screen.getByRole("button", { name: "Wechseln" }));
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Distanz (m)")).toBeInTheDocument();
  });

  it("Abbrechen im Dialog behält Typ und Draft-Daten", () => {
    render(<WorkoutLogger exercises={[]} />);
    // Draft dirty machen
    fireEvent.change(screen.getByLabelText("Wdh."), { target: { value: "8" } });
    // Typ wechseln → Dialog erscheint
    fireEvent.change(screen.getByLabelText("Typ"), { target: { value: "wod" } });
    expect(screen.getByText("Typ wechseln?")).toBeInTheDocument();
    // "Abbrechen" im Dialog (letzter Button mit diesem Namen) klicken
    const abrechenButtons = screen.getAllByRole("button", { name: "Abbrechen" });
    fireEvent.click(abrechenButtons[abrechenButtons.length - 1]);
    // Dialog weg, Typ-Select zeigt weiterhin "strength", RPE-Body bleibt
    expect(screen.queryByText("Typ wechseln?")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Typ")).toHaveValue("strength");
    expect(screen.getByLabelText("RPE")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe("WorkoutLogger — Aktionen (Smoke)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Anlegen-Button ist im Anlegen-Modus vorhanden", () => {
    render(<WorkoutLogger exercises={[]} />);
    expect(screen.getByRole("button", { name: "Anlegen" })).toBeInTheDocument();
  });

  it("Abbrechen-Button ruft router.back() auf", () => {
    render(<WorkoutLogger exercises={[]} />);
    // Erster Abbrechen-Button = Aktionsleiste (kein Dialog offen)
    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it('"Als Vorlage"-Button öffnet Template-Modal', () => {
    render(<WorkoutLogger exercises={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Als Vorlage" }));
    expect(screen.getByText("Als Vorlage speichern")).toBeInTheDocument();
  });

  it("Löschen-Button fehlt im Anlegen-Modus, ist im Bearbeiten-Modus vorhanden", () => {
    const { unmount } = render(<WorkoutLogger exercises={[]} />);
    expect(screen.queryByRole("button", { name: "Löschen" })).not.toBeInTheDocument();
    unmount();

    render(<WorkoutLogger exercises={[]} workout={mockWorkout} />);
    expect(screen.getByRole("button", { name: "Löschen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Speichern" })).toBeInTheDocument();
  });
});
