import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendTelegram: vi.fn() }));
vi.mock("@/lib/notify/telegram", () => ({ sendTelegram: mocks.sendTelegram }));

import { isDue, runJournalReminders } from "@/lib/journal/reminder-cron";

describe("isDue", () => {
  it("is false when disabled", () => {
    expect(isDue(false, "07:00", null, "08:00", "2026-07-06")).toBe(false);
  });

  it("is false before the configured time", () => {
    expect(isDue(true, "07:00", null, "06:59", "2026-07-06")).toBe(false);
  });

  it("is true at/after the configured time when not yet sent today", () => {
    expect(isDue(true, "07:00", null, "07:00", "2026-07-06")).toBe(true);
    expect(isDue(true, "07:00", "2026-07-05", "08:00", "2026-07-06")).toBe(true);
  });

  it("is false once already sent today", () => {
    expect(isDue(true, "07:00", "2026-07-06", "08:00", "2026-07-06")).toBe(false);
  });
});

type FakeRow = {
  user_id: string;
  morning_enabled: boolean;
  morning_time: string;
  morning_last_sent_on: string | null;
  evening_enabled: boolean;
  evening_time: string;
  evening_last_sent_on: string | null;
};

function makeSettingsClient(rows: FakeRow[]) {
  const updates: { table: string; values: unknown; col: string; val: string }[] = [];
  return {
    updates,
    client: {
      from: (table: string) => ({
        select: () => Promise.resolve({ data: rows, error: null }),
        update: (values: Record<string, unknown>) => ({
          eq: (col: string, val: string) => {
            updates.push({ table, values, col, val });
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    },
  };
}

describe("runJournalReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the morning push and stamps last_sent_on when due", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: null,
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    // 05:30 UTC = 07:30 CEST (Europe/Berlin, July → DST) — past the 07:00 threshold.
    const result = await runJournalReminders(client as never, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(1);
    expect(mocks.sendTelegram).toHaveBeenCalledTimes(1);
    expect(updates).toContainEqual(
      expect.objectContaining({
        col: "user_id",
        val: "u1",
        values: { morning_last_sent_on: "2026-07-06" },
      }),
    );
  });

  it("skips a user whose reminder already fired today", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: "2026-07-06",
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    const result = await runJournalReminders(client as never, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(0);
    expect(mocks.sendTelegram).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("does not stamp last_sent_on when the Telegram push fails", async () => {
    mocks.sendTelegram.mockResolvedValue(false);
    const { client, updates } = makeSettingsClient([
      {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        morning_last_sent_on: null,
        evening_enabled: false,
        evening_time: "21:00",
        evening_last_sent_on: null,
      },
    ]);

    const result = await runJournalReminders(client as never, new Date("2026-07-06T05:30:00Z"));

    expect(result.sent).toBe(0);
    expect(updates).toHaveLength(0);
  });
});
