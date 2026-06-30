import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { DEFAULT_AREAS, seedDefaultAreas } from "./seed";

// Builds a chainable supabase mock that returns a preset count and captures inserts.
function makeClient(count: number | null) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ count, error: null }),
  });
  const from = vi.fn().mockReturnValue({ select, insert });
  return {
    client: {
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from,
    },
    insert,
  };
}

describe("seedDefaultAreas (TASK-011)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts the four default areas when none exist", async () => {
    const { client, insert } = makeClient(0);
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultAreas();

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(DEFAULT_AREAS.length);
    expect(rows.map((r: { slug: string }) => r.slug)).toEqual([
      "familie",
      "fitness",
      "haus",
      "side-projects",
    ]);
    expect(rows.every((r: { user_id: string }) => r.user_id === "user-1")).toBe(
      true,
    );
  });

  it("does nothing when areas already exist", async () => {
    const { client, insert } = makeClient(4);
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultAreas();

    expect(insert).not.toHaveBeenCalled();
  });
});
