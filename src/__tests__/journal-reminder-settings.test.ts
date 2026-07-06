import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getReminderSettings,
  updateReminderSettings,
} from "@/lib/journal/reminder-settings";

function makeClient(opts: { row?: Record<string, unknown> | null } = {}) {
  const upserts: { table: string; values: unknown; options: unknown }[] = [];
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.maybeSingle = async () => ({ data: opts.row ?? null, error: null });
    b.upsert = (values: unknown, options: unknown) => {
      upserts.push({ table, values, options });
      return Promise.resolve({ data: null, error: null });
    };
    return b;
  }
  return {
    upserts,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
    },
  };
}

describe("getReminderSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns defaults when no row exists yet", async () => {
    const { client } = makeClient({ row: null });
    mocks.createClient.mockResolvedValue(client);

    const settings = await getReminderSettings();

    expect(settings).toEqual({
      morning_enabled: true,
      morning_time: "07:00",
      evening_enabled: true,
      evening_time: "21:00",
    });
  });

  it("maps a stored row, trimming seconds off the time columns", async () => {
    const { client } = makeClient({
      row: {
        morning_enabled: false,
        morning_time: "07:30:00",
        evening_enabled: true,
        evening_time: "22:00:00",
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const settings = await getReminderSettings();

    expect(settings).toEqual({
      morning_enabled: false,
      morning_time: "07:30",
      evening_enabled: true,
      evening_time: "22:00",
    });
  });
});

describe("updateReminderSettings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts the given patch scoped to the current user", async () => {
    const { client, upserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await updateReminderSettings({ morning_time: "07:45" });

    expect(upserts).toHaveLength(1);
    expect(upserts[0].table).toBe("journal_reminder_settings");
    expect(upserts[0].values).toMatchObject({
      user_id: "u1",
      morning_time: "07:45",
    });
    expect(upserts[0].options).toMatchObject({ onConflict: "user_id" });
  });
});
