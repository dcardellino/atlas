import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { create, toggleComplete, list, remove } from "./actions";

/**
 * Builds a chainable Supabase mock. `singleData` is what `.single()` resolves to;
 * `listData` is what an awaited query (ending in `.order()`/`.eq()`) resolves to.
 * `inserted` collects every insert payload; `deletes` collects delete calls with
 * their accumulated `eq` filters, for assertions.
 */
function makeClient(opts: { singleData?: unknown; listData?: unknown[] } = {}) {
  const inserted: { table: string; values: unknown }[] = [];
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
    b.delete = () => {
      deletes.push({ table, filters });
      return b;
    };
    b.insert = (values: unknown) => {
      inserted.push({ table, values });
      return b;
    };
    b.update = chain;
    b.single = async () => ({ data: opts.singleData ?? null, error: null });
    // Awaiting the chain (list / update / insert) resolves here.
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: opts.listData ?? null, error: null });
    return b;
  }

  return {
    inserted,
    deletes,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
    },
  };
}

describe("tasks actions (TASK-018)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create inserts a task with the user id", async () => {
    const { client, inserted } = makeClient({
      singleData: { id: "t1", title: "X" },
    });
    mocks.createClient.mockResolvedValue(client);

    await create({ title: "Öl checken", area_id: "a1" });

    const insert = inserted.find((i) => i.table === "tasks");
    expect(insert).toBeTruthy();
    expect(insert!.values).toMatchObject({
      user_id: "u1",
      title: "Öl checken",
      area_id: "a1",
    });
  });

  it("list filters to open tasks by default", async () => {
    const { client } = makeClient({ listData: [{ id: "t1", status: "open" }] });
    mocks.createClient.mockResolvedValue(client);

    const rows = await list();
    expect(rows).toHaveLength(1);
  });

  it("remove deletes the task scoped to id and user", async () => {
    const { client, deletes } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await remove("t1");

    const del = deletes.find((d) => d.table === "tasks");
    expect(del).toBeTruthy();
    expect(del?.filters).toMatchObject({ id: "t1", user_id: "u1" });
  });

  it("completing a recurring task creates the next instance", async () => {
    const { client, inserted } = makeClient({
      singleData: {
        id: "t1",
        title: "Mobility",
        status: "open",
        recurrence: "daily",
        due_at: "2026-07-01T06:00:00.000Z",
        area_id: "a1",
        notes: null,
        reminder_at: null,
      },
    });
    mocks.createClient.mockResolvedValue(client);

    await toggleComplete("t1");

    const next = inserted.find((i) => i.table === "tasks");
    expect(next).toBeTruthy();
    expect(next!.values).toMatchObject({
      title: "Mobility",
      recurrence: "daily",
      due_at: "2026-07-02T06:00:00.000Z",
    });
  });
});
