import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createWorkout,
  updateWorkout,
  removeWorkout,
  createExercise,
  instantiateTemplate,
} from "@/lib/workouts/actions";

/**
 * Workout actions: the extended chainable Supabase mock captures inserts AND
 * lets `insert().select().single()` / `insert().select()` return fake ids, which
 * the routines mock did not. Asserts user_id stamping across workout+blocks+sets,
 * the 3-insert ordering with block-id→set mapping, double-scoped update/delete,
 * fitness-area resolution and template instantiation with null results.
 */

type ClientOpts = {
  // Rows returned by an awaited select (`.then`) per table.
  tableData?: Record<string, unknown[]>;
  // Row returned by `.single()`/`.maybeSingle()` on a NON-insert query per table.
  tableSingle?: Record<string, unknown>;
};

function makeClient(opts: ClientOpts = {}) {
  const inserts: { table: string; values: unknown }[] = [];
  const updates: { table: string; values: Record<string, unknown>; filters: Record<string, unknown> }[] = [];
  const deletes: { table: string; filters: Record<string, unknown> }[] = [];

  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    let insertedRows: unknown = null;
    const chain = () => b;
    b.select = chain;
    b.eq = (col: string, val: unknown) => {
      filters[col] = val;
      return b;
    };
    b.order = chain;
    b.is = chain;
    b.delete = () => {
      deletes.push({ table, filters });
      return b;
    };
    b.update = (values: Record<string, unknown>) => {
      updates.push({ table, values, filters });
      return b;
    };
    b.insert = (values: unknown) => {
      insertedRows = values;
      inserts.push({ table, values });
      return b;
    };
    b.maybeSingle = async () => ({
      data: opts.tableSingle?.[table] ?? null,
      error: null,
    });
    b.single = async () => {
      if (insertedRows && !Array.isArray(insertedRows)) {
        // insert().select().single() → return the row with a stable fake id.
        return {
          data: { id: `${table}-new`, ...(insertedRows as object) },
          error: null,
        };
      }
      return { data: opts.tableSingle?.[table] ?? null, error: null };
    };
    // Awaiting the chain resolves here.
    b.then = (resolve: (v: unknown) => void) => {
      if (Array.isArray(insertedRows) && table === "workout_blocks") {
        // insert(rows).select("id, position") → one {id, position} per row.
        const rows = (insertedRows as { position: number }[]).map((r) => ({
          id: `block-${r.position}`,
          position: r.position,
        }));
        return resolve({ data: rows, error: null });
      }
      if (insertedRows) return resolve({ data: null, error: null });
      return resolve({ data: opts.tableData?.[table] ?? null, error: null });
    };
    return b;
  }

  return {
    inserts,
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

const baseInput = {
  type: "strength" as const,
  performed_on: "2026-07-04",
  blocks: [
    {
      mode: "straight" as const,
      name: "Kniebeuge",
      sets: [
        { exercise_id: "e1", exercise_name: "Kniebeuge", reps: 5, weight_kg: 100 },
        { exercise_id: "e1", exercise_name: "Kniebeuge", reps: 5, weight_kg: 100 },
      ],
    },
    {
      mode: "amrap" as const,
      name: "Metcon",
      duration_seconds: 720,
      result_rounds: 8,
      result_reps: 4,
      sets: [{ exercise_id: null, exercise_name: "Burpees", reps: 10 }],
    },
  ],
};

describe("workout actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createWorkout stamps user_id on workout, blocks and sets and resolves the fitness area", async () => {
    const { client, inserts } = makeClient({
      tableSingle: { areas: { id: "area-fit" } },
    });
    mocks.createClient.mockResolvedValue(client);

    await createWorkout(baseInput);

    const workout = inserts.find((i) => i.table === "workouts");
    expect(workout!.values).toMatchObject({
      user_id: "u1",
      type: "strength",
      performed_on: "2026-07-04",
      area_id: "area-fit",
    });

    const blocks = inserts.find((i) => i.table === "workout_blocks");
    const blockRows = blocks!.values as Record<string, unknown>[];
    expect(blockRows).toHaveLength(2);
    expect(blockRows.every((r) => r.user_id === "u1")).toBe(true);
    expect(blockRows.map((r) => r.position)).toEqual([0, 1]);
    // AMRAP-Ergebnis erhalten, straight-Block ohne Ergebnis.
    expect(blockRows[1]).toMatchObject({ mode: "amrap", result_rounds: 8, result_reps: 4 });

    const sets = inserts.find((i) => i.table === "workout_sets");
    const setRows = sets!.values as Record<string, unknown>[];
    expect(setRows).toHaveLength(3);
    expect(setRows.every((r) => r.user_id === "u1")).toBe(true);
    // Block-id→Set-Mapping: erste zwei Sätze zu block-0, dritter zu block-1.
    expect(setRows.map((r) => r.block_id)).toEqual(["block-0", "block-0", "block-1"]);
    expect(setRows[0]).toMatchObject({ exercise_name: "Kniebeuge", reps: 5, weight_kg: 100 });
  });

  it("updateWorkout deletes children then reinserts, scoped to id and user", async () => {
    const { client, deletes, updates, inserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await updateWorkout("w9", baseInput);

    const wu = updates.find((u) => u.table === "workouts");
    expect(wu!.filters).toMatchObject({ id: "w9", user_id: "u1" });

    const blockDelete = deletes.find((d) => d.table === "workout_blocks");
    expect(blockDelete!.filters).toMatchObject({ workout_id: "w9", user_id: "u1" });

    // Blöcke werden neu eingefügt.
    expect(inserts.find((i) => i.table === "workout_blocks")).toBeTruthy();
  });

  it("removeWorkout deletes scoped to id and user", async () => {
    const { client, deletes } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await removeWorkout("w9");

    const del = deletes.find((d) => d.table === "workouts");
    expect(del!.filters).toMatchObject({ id: "w9", user_id: "u1" });
  });

  it("createExercise stamps the user id and is_default false", async () => {
    const { client, inserts } = makeClient();
    mocks.createClient.mockResolvedValue(client);

    await createExercise({ name: "Thruster", category: "strength", metrics: ["reps", "weight"] });

    const ex = inserts.find((i) => i.table === "exercises");
    expect(ex!.values).toMatchObject({ user_id: "u1", name: "Thruster", is_default: false });
  });

  it("createWorkout propagates rpe from SetInput into the workout_sets insert", async () => {
    const { client, inserts } = makeClient({
      tableSingle: { areas: { id: "area-fit" } },
    });
    mocks.createClient.mockResolvedValue(client);

    await createWorkout({
      type: "strength",
      performed_on: "2026-07-06",
      blocks: [
        {
          mode: "straight" as const,
          name: "Kniebeuge",
          sets: [
            { exercise_id: "e1", exercise_name: "Kniebeuge", reps: 5, weight_kg: 100, rpe: 7.5 },
            { exercise_id: "e1", exercise_name: "Kniebeuge", reps: 5, weight_kg: 100, rpe: null },
          ],
        },
      ],
    });

    const sets = inserts.find((i) => i.table === "workout_sets");
    const setRows = sets!.values as Record<string, unknown>[];
    expect(setRows).toHaveLength(2);
    expect(setRows[0].rpe).toBe(7.5);
    expect(setRows[1].rpe).toBeNull();
  });

  it("instantiateTemplate creates a workout with null result columns", async () => {
    const { client, inserts } = makeClient({
      tableSingle: {
        areas: { id: "area-fit" },
        workout_templates: {
          id: "t1",
          name: "Leg Day",
          type: "strength",
          structure: [
            {
              mode: "amrap",
              name: "Metcon",
              duration_seconds: 600,
              sets: [{ exercise_id: "e1", exercise_name: "Wall Balls", reps: 20 }],
            },
          ],
        },
      },
    });
    mocks.createClient.mockResolvedValue(client);

    const id = await instantiateTemplate("t1", "2026-07-04");
    expect(id).toBe("workouts-new");

    const blocks = inserts.find((i) => i.table === "workout_blocks");
    const blockRows = blocks!.values as Record<string, unknown>[];
    expect(blockRows[0]).toMatchObject({
      mode: "amrap",
      duration_seconds: 600,
      result_rounds: null,
      result_reps: null,
      result_seconds: null,
    });
  });
});
