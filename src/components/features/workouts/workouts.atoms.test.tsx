import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createExercise: vi.fn() }));
vi.mock("@/lib/workouts/actions", () => ({
  createExercise: mocks.createExercise,
}));

import { BlockCard } from "./BlockCard";
import { SetRow } from "./SetRow";
import { emptyBlock, emptySet } from "@/lib/workouts/draft";

/**
 * Smoke-Render-Tests für die extrahierten UI-Atome.
 * Regressionsnetz für die Extraktion aus WorkoutLogger.tsx — kein umfassender
 * Component-Test (der kommt mit den typspezifischen Bodies in Task 5–8).
 */
describe("BlockCard", () => {
  const noop = () => {};
  const block = emptyBlock("straight");

  it("renders without crash and shows mode select", () => {
    render(
      <BlockCard
        block={block}
        index={0}
        library={[]}
        metricsFor={() => ["reps", "weight"]}
        onPatch={noop}
        onRemove={noop}
        onPatchSet={noop}
        onAddSet={noop}
        onRemoveSet={noop}
        onExerciseCreated={noop}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Modus" })).toBeInTheDocument();
    expect(screen.getByText("Block 1")).toBeInTheDocument();
  });

  it("shows EMOM config fields when mode is emom", () => {
    const emomBlock = emptyBlock("emom");
    render(
      <BlockCard
        block={emomBlock}
        index={1}
        library={[]}
        metricsFor={() => ["reps"]}
        onPatch={noop}
        onRemove={noop}
        onPatchSet={noop}
        onAddSet={noop}
        onRemoveSet={noop}
        onExerciseCreated={noop}
      />,
    );

    expect(screen.getByText("Intervall (Sek.)")).toBeInTheDocument();
    expect(screen.getByText("Runden")).toBeInTheDocument();
    expect(screen.getByText("Block 2")).toBeInTheDocument();
  });
});

describe("SetRow", () => {
  const noop = () => {};
  const set = emptySet();

  it("renders metric fields for given metrics", () => {
    render(
      <ul>
        <SetRow
          set={set}
          index={0}
          metrics={["reps", "weight"]}
          library={[]}
          onPatch={noop}
          onRemove={noop}
          onExerciseCreated={noop}
        />
      </ul>,
    );

    expect(screen.getByText("Wdh.")).toBeInTheDocument();
    expect(screen.getByText("kg")).toBeInTheDocument();
    expect(screen.getByText("Aufwärmen")).toBeInTheDocument();
  });

  it("renders only the specified metrics", () => {
    render(
      <ul>
        <SetRow
          set={set}
          index={0}
          metrics={["distance", "duration"]}
          library={[]}
          onPatch={noop}
          onRemove={noop}
          onExerciseCreated={noop}
        />
      </ul>,
    );

    expect(screen.getByText("m")).toBeInTheDocument();
    expect(screen.getByText("Sek.")).toBeInTheDocument();
    expect(screen.queryByText("Wdh.")).not.toBeInTheDocument();
    expect(screen.queryByText("kg")).not.toBeInTheDocument();
  });
});
