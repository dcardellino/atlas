import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { slugify } from "@/lib/areas/slug";
import {
  create,
  reorder,
  listOrphans,
  reassignOrphan,
} from "@/lib/areas/actions";

/**
 * Areas actions (TASK-026/028, FR-005): slug uniqueness on create, reorder
 * persistence, and orphan listing/reassignment.
 */

type ClientOpts = {
  tableData?: Record<string, unknown[]>;
  singleData?: unknown;
};

function makeClient(opts: ClientOpts = {}) {
  const inserted: { table: string; values: Record<string, unknown> }[] = [];
  const updates: { table: string; values: Record<string, unknown> }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.order = chain;
    b.is = chain;
    b.not = chain;
    b.delete = chain;
    b.insert = (values: Record<string, unknown>) => {
      inserted.push({ table, values });
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      updates.push({ table, values });
      return b;
    };
    b.single = async () => ({ data: opts.singleData ?? null, error: null });
    b.then = (resolve: (v: unknown) => void) =>
      resolve({ data: opts.tableData?.[table] ?? null, error: null });
    return b;
  }

  return {
    inserted,
    updates,
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: (table: string) => builder(table),
    },
  };
}

describe("areas actions (TASK-026)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("slugify transliterates umlauts and dashes the rest", () => {
    expect(slugify("Side-Projects")).toBe("side-projects");
    expect(slugify("Größe & Übung")).toBe("groesse-uebung");
    expect(slugify("  Haus  ")).toBe("haus");
  });

  it("create gives a colliding name a unique slug and next sort_order", async () => {
    const { client, inserted } = makeClient({
      tableData: {
        areas: [
          { slug: "familie", sort_order: 0 },
          { slug: "fitness", sort_order: 1 },
        ],
      },
      singleData: { id: "a3", slug: "familie-2" },
    });
    mocks.createClient.mockResolvedValue(client);

    await create({ name: "Familie", color: "cat-rust" });

    const insert = inserted.find((i) => i.table === "areas");
    expect(insert).toBeTruthy();
    expect(insert!.values).toMatchObject({
      user_id: "u1",
      name: "Familie",
      slug: "familie-2",
      sort_order: 2,
    });
  });

  it("reorder writes the new sort_order for every id", async () => {
    const { client, updates } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await reorder(["c", "a", "b"]);

    const areaUpdates = updates.filter((u) => u.table === "areas");
    expect(areaUpdates).toHaveLength(3);
    expect(areaUpdates.map((u) => u.values.sort_order)).toEqual([0, 1, 2]);
  });

  it("listOrphans collects area-less tasks and routines", async () => {
    const { client } = makeClient({
      tableData: {
        tasks: [{ id: "t1", title: "Steuer" }],
        routines: [{ id: "r1", name: "Mobility" }],
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const orphans = await listOrphans();
    expect(orphans).toEqual([
      { id: "t1", kind: "task", title: "Steuer" },
      { id: "r1", kind: "routine", title: "Mobility" },
    ]);
  });

  it("reassignOrphan updates the routines table for a routine", async () => {
    const { client, updates } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await reassignOrphan("routine", "r1", "area-9");

    const upd = updates.find((u) => u.table === "routines");
    expect(upd?.values).toMatchObject({ area_id: "area-9" });
  });
});
