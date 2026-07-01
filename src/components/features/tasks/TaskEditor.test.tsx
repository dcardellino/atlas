import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/tasks/actions", () => ({
  create: mocks.create,
  update: mocks.update,
}));

import TaskEditor from "./TaskEditor";

/**
 * Manual create path (no AI capture): with task=null the editor calls `create`;
 * with a task it calls `update`.
 */
describe("TaskEditor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a task when task is null", async () => {
    mocks.create.mockResolvedValue({ id: "t1" });
    const onClose = vi.fn();
    render(<TaskEditor task={null} areas={[]} onClose={onClose} />);

    expect(screen.getByText("Neue Aufgabe")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Titel" }), {
      target: { value: "Öl checken" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ title: "Öl checken" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates a task when a task is provided", () => {
    mocks.update.mockResolvedValue(undefined);
    render(
      <TaskEditor
        task={{
          id: "t1",
          area_id: null,
          title: "Bestehend",
          notes: null,
          due_at: null,
          reminder_at: null,
          is_top3: false,
          status: "open",
          completed_at: null,
          recurrence: null,
          created_at: "",
          updated_at: "",
        }}
        areas={[]}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Aufgabe bearbeiten")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
