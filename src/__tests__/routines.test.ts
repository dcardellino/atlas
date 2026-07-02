import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  currentStreak,
  lastNDays,
  isoWeekStart,
  weeklyCount,
  weeklyProgress,
  weeklyStreak,
} from "@/lib/routines/streak";
import { logToday, listWithState, remove } from "@/lib/routines/actions";

/**
 * Routines actions + streak (TASK-029/030/031, FR-007): pure streak edges,
 * idempotent logToday, and lazy auto-archive of time-boxed routines.
 */

type ClientOpts = {
  tableData?: Record<string, unknown[]>;
  singleData?: unknown;
};

function makeClient(opts: ClientOpts = {}) {
  const upserts: {
    table: string;
    values: Record<string, unknown>;
    options: unknown;
  }[] = [];
  const updates: { table: string; values: Record<string, unknown> }[] = [];
  const deletes: { table: string; filters: Record<string, unknown> }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return b;
    };
    b.order = chain;
    b.is = chain;
    b.not = chain;
    b.delete = () => {
      deletes.push({ table, filters });
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      updates.push({ table, values });
      return b;
    };
    b.upsert = (values: Record<string, unknown>, options: unknown) => {
      upserts.push({ table, values, options });
      return b;
    };
    b.single = async () => ({ data: opts.singleData ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: opts.tableData?.[table] ?? null, error: null });
    return b;
  }

  return {
    upserts,
    updates,
    deletes,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
    },
  };
}

describe("currentStreak (TASK-030)", () => {
  it("counts consecutive days ending today", () => {
    const logs = ["2026-06-30", "2026-06-29", "2026-06-28"];
    expect(currentStreak(logs, "2026-06-30")).toBe(3);
  });

  it("still counts when today isn't logged but yesterday is", () => {
    const logs = ["2026-06-29", "2026-06-28"];
    expect(currentStreak(logs, "2026-06-30")).toBe(2);
  });

  it("breaks on a missing day", () => {
    const logs = ["2026-06-30", "2026-06-28", "2026-06-27"];
    expect(currentStreak(logs, "2026-06-30")).toBe(1);
  });

  it("is zero when neither today nor yesterday is logged", () => {
    expect(currentStreak(["2026-06-20"], "2026-06-30")).toBe(0);
  });

  it("ignores duplicate log dates", () => {
    expect(currentStreak(["2026-06-30", "2026-06-30"], "2026-06-30")).toBe(1);
  });

  it("lastNDays maps completion oldest → newest", () => {
    const days = lastNDays(["2026-06-30", "2026-06-28"], "2026-06-30", 3);
    expect(days).toEqual([
      { date: "2026-06-28", done: true },
      { date: "2026-06-29", done: false },
      { date: "2026-06-30", done: true },
    ]);
  });
});

describe("weekly frequency streaks", () => {
  // 2026-06-30 is a Tuesday → its ISO week starts Monday 2026-06-29.
  it("isoWeekStart returns the Monday of the week", () => {
    expect(isoWeekStart("2026-06-30")).toBe("2026-06-29"); // Tue → Mon
    expect(isoWeekStart("2026-06-29")).toBe("2026-06-29"); // Mon → itself
    expect(isoWeekStart("2026-07-05")).toBe("2026-06-29"); // Sun → prior Mon
    expect(isoWeekStart("2026-07-06")).toBe("2026-07-06"); // next Mon
  });

  it("weeklyCount counts distinct days in the ISO week and ignores duplicates", () => {
    const logs = ["2026-06-29", "2026-06-29", "2026-07-01", "2026-07-06"];
    // Week of 2026-06-29 spans Mon 29th … Sun 5th: the 6th falls in the next week.
    expect(weeklyCount(logs, "2026-06-29")).toBe(2);
  });

  it("weeklyProgress reports the current week's distinct days", () => {
    const logs = ["2026-06-29", "2026-06-30"];
    expect(weeklyProgress(logs, "2026-06-30")).toBe(2);
  });

  it("weeklyStreak counts consecutive weeks that met the target", () => {
    const logs = [
      // this week (of 29 Jun): 2 done, target 2 → met
      "2026-06-29",
      "2026-06-30",
      // last week (of 22 Jun): 2 done → met
      "2026-06-22",
      "2026-06-24",
      // two weeks ago (of 15 Jun): 1 done → misses target 2 → breaks
      "2026-06-15",
    ];
    expect(weeklyStreak(logs, "2026-06-30", 2)).toBe(2);
  });

  it("weeklyStreak: an unfinished current week does not break the run", () => {
    const logs = [
      // current week: only 1 so far (target 2, not yet met)
      "2026-06-30",
      // last week: 2 → met
      "2026-06-22",
      "2026-06-24",
    ];
    expect(weeklyStreak(logs, "2026-06-30", 2)).toBe(1);
  });

  it("weeklyStreak is zero when neither this nor last week met the target", () => {
    expect(weeklyStreak(["2026-06-30"], "2026-06-30", 2)).toBe(0);
  });
});

describe("routines actions (TASK-029/031)", () => {
  beforeEach(() => vi.clearAllMocks());

  const NOW = new Date("2026-06-30T12:00:00Z");
  const TZ = "Europe/Berlin";

  it("logToday upserts idempotently on (routine_id, log_date)", async () => {
    const { client, upserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await logToday("r1", NOW, TZ);

    const up = upserts.find((u) => u.table === "routine_logs");
    expect(up?.values).toMatchObject({
      user_id: "u1",
      routine_id: "r1",
      log_date: "2026-06-30",
      completed: true,
    });
    expect(up?.options).toMatchObject({
      onConflict: "routine_id,log_date",
      ignoreDuplicates: true,
    });
  });

  it("remove deletes the routine scoped to id and user", async () => {
    const { client, deletes } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await remove("r1");

    const del = deletes.find((d) => d.table === "routines");
    expect(del).toBeTruthy();
    expect(del?.filters).toMatchObject({ id: "r1", user_id: "u1" });
  });

  it("listWithState archives elapsed time-boxed routines and computes streaks", async () => {
    const { client, updates } = makeClient({
      tableData: {
        routines: [
          {
            id: "r-active",
            area_id: null,
            name: "Mobility",
            time_of_day: "morning",
            duration_days: null,
            start_date: "2026-06-01",
            archived_at: null,
            created_at: "2026-06-01T00:00:00Z",
          },
          {
            id: "r-expired",
            area_id: null,
            name: "7-Tage-Challenge",
            time_of_day: "evening",
            duration_days: 7,
            start_date: "2026-06-01",
            archived_at: null,
            created_at: "2026-06-01T00:00:00Z",
          },
        ],
        routine_logs: [
          { routine_id: "r-active", log_date: "2026-06-30" },
          { routine_id: "r-active", log_date: "2026-06-29" },
        ],
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const states = await listWithState(NOW, TZ);

    // The expired routine is archived and dropped from the active list.
    expect(states.map((s) => s.routine.id)).toEqual(["r-active"]);
    const archived = updates.find(
      (u) => u.table === "routines" && "archived_at" in u.values,
    );
    expect(archived?.values.archived_at).toBeTruthy();

    // Active routine: logged today, two-day streak.
    expect(states[0].loggedToday).toBe(true);
    expect(states[0].streak).toBe(2);
    expect(states[0].last30).toHaveLength(30);
  });
});
