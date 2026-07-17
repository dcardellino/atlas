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

/**
 * Table-aware fake client. `journal_reminder_settings` yields the settings rows;
 * `areas` yields the data owners the cron enumerates (defaulting to the owners of
 * the given settings rows). Upserts are captured for assertions.
 */
function makeSettingsClient(
  rows: FakeRow[],
  ownerIds?: string[],
) {
  const owners = (ownerIds ?? [...new Set(rows.map((r) => r.user_id))]).map(
    (user_id) => ({ user_id }),
  );
  const upserts: { table: string; values: Record<string, unknown> }[] = [];
  return {
    upserts,
    client: {
      from: (table: string) => ({
        select: () =>
          Promise.resolve({
            data: table === "areas" ? owners : rows,
            error: null,
          }),
        upsert: (values: Record<string, unknown>) => {
          upserts.push({ table, values });
          return Promise.resolve({ data: null, error: null });
        },
      }),
    },
  };
}

describe("runJournalReminders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the morning push and stamps last_sent_on when due", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, upserts } = makeSettingsClient([
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
    // Row already exists → the upsert touches only the stamp, not the saved values.
    expect(upserts).toContainEqual({
      table: "journal_reminder_settings",
      values: { user_id: "u1", morning_last_sent_on: "2026-07-06" },
    });
  });

  it("skips a user whose reminder already fired today", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    const { client, upserts } = makeSettingsClient([
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
    expect(upserts).toHaveLength(0);
  });

  it("does not stamp last_sent_on when the Telegram push fails", async () => {
    mocks.sendTelegram.mockResolvedValue(false);
    const { client, upserts } = makeSettingsClient([
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
    expect(upserts).toHaveLength(0);
  });

  it("applies defaults for a data-owning user with no settings row", async () => {
    mocks.sendTelegram.mockResolvedValue(true);
    // No settings rows, but u1 owns data (areas). Defaults: morning 07:00 on,
    // evening 21:00 on.
    const { client, upserts } = makeSettingsClient([], ["u1"]);

    // 20:00 UTC = 22:00 CEST — past both the 07:00 and 21:00 default thresholds.
    const result = await runJournalReminders(client as never, new Date("2026-07-06T20:00:00Z"));

    expect(result.sent).toBe(2);
    expect(mocks.sendTelegram).toHaveBeenCalledTimes(2);
    // First push lazily creates the row with the default settings + the stamp.
    expect(upserts[0]).toEqual({
      table: "journal_reminder_settings",
      values: {
        user_id: "u1",
        morning_enabled: true,
        morning_time: "07:00",
        evening_enabled: true,
        evening_time: "21:00",
        morning_last_sent_on: "2026-07-06",
      },
    });
    // Row now exists → the evening upsert only touches its stamp.
    expect(upserts[1]).toEqual({
      table: "journal_reminder_settings",
      values: { user_id: "u1", evening_last_sent_on: "2026-07-06" },
    });
  });
});
