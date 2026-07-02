import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Reclassification / correction (TASK-053, FR-012). Moving a captured item to a
 * new type deletes the old target row (when there was one), creates the new-type
 * row from the raw text, and stamps corrected_* on the inbox item so the change
 * is countable for the correction-rate metric (TASK-057). The Supabase boundary
 * is mocked; the action logic runs for real.
 */

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  ops: [] as { op: string; table: string; values?: Record<string, unknown> }[],
  inbox: {} as Record<string, unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function makeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
    },
    from(table: string) {
      return {
        select() {
          const r = {
            eq: () => r,
            single: async () => ({ data: mocks.inbox, error: null }),
          };
          return r;
        },
        insert(values: Record<string, unknown>) {
          mocks.ops.push({ op: "insert", table, values });
          return {
            select: () => ({
              single: async () => ({ data: { id: `${table}-new` }, error: null }),
            }),
          };
        },
        delete() {
          const r = {
            eq: () => r,
            then: (res: (v: unknown) => void) => {
              mocks.ops.push({ op: "delete", table });
              return res({ data: null, error: null });
            },
          };
          return r;
        },
        update(values: Record<string, unknown>) {
          const r = {
            eq: () => r,
            then: (res: (v: unknown) => void) => {
              mocks.ops.push({ op: "update", table, values });
              return res({ data: null, error: null });
            },
          };
          return r;
        },
      };
    },
  };
}

import { reclassify } from "@/lib/inbox/reclassify";

describe("reclassify (TASK-053, FR-012)", () => {
  beforeEach(() => {
    mocks.ops.length = 0;
    mocks.createClient.mockResolvedValue(makeClient());
  });

  it("moves a note into a task and logs the correction", async () => {
    // A plain note lives on the inbox item itself → nothing to delete.
    mocks.inbox = {
      id: "inbox-1",
      raw_text: "Öl checken",
      source: "pwa_text",
      classified_type: "note",
      classified_into: "inbox-1",
    };

    await reclassify({ inboxId: "inbox-1", toType: "task", areaId: "area-haus" });

    expect(mocks.ops.some((o) => o.op === "delete")).toBe(false);
    const insert = mocks.ops.find((o) => o.op === "insert");
    expect(insert?.table).toBe("tasks");
    expect(insert?.values).toMatchObject({
      user_id: "user-1",
      area_id: "area-haus",
      title: "Öl checken",
    });

    const update = mocks.ops.find((o) => o.op === "update");
    expect(update?.table).toBe("inbox_items");
    expect(update?.values).toMatchObject({
      classified_type: "task",
      classified_into: "tasks-new",
      corrected_type: "task",
      corrected_area_id: "area-haus",
    });
    expect(update?.values?.corrected_at).toBeTruthy();
  });

  it("deletes the old typed row when moving task → journal", async () => {
    mocks.inbox = {
      id: "inbox-2",
      raw_text: "Heute war anstrengend",
      source: "pwa_voice",
      classified_type: "task",
      classified_into: "task-9",
    };

    await reclassify({ inboxId: "inbox-2", toType: "journal", areaId: null });

    const del = mocks.ops.find((o) => o.op === "delete");
    expect(del?.table).toBe("tasks");
    const insert = mocks.ops.find((o) => o.op === "insert");
    expect(insert?.table).toBe("journal_entries");
    expect(insert?.values).toMatchObject({ body: "Heute war anstrengend" });
  });
});
