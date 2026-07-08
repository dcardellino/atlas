import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReminderStatus from "./ReminderStatus";

describe("ReminderStatus", () => {
  it("shows Telegram as configured and formats the last-sent timestamp", () => {
    render(
      <ReminderStatus
        data={{
          telegramConfigured: true,
          lastSentAt: "2026-07-08T09:30:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("Konfiguriert")).toBeInTheDocument();
    expect(screen.getByText("08.07.2026 11:30")).toBeInTheDocument();
  });

  it("shows a dash when no reminder has been sent yet", () => {
    render(
      <ReminderStatus data={{ telegramConfigured: false, lastSentAt: null }} />,
    );
    expect(screen.getByText("Nicht gesetzt")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
