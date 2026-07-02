import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { DEFAULT_AREAS, seedDefaultAreas } from "./seed";

// Builds a chainable supabase mock that returns a preset count and captures
// inserts. Each test uses a distinct userId so the per-instance "ensured" memo in
// seedDefaultAreas (TASK-055) doesn't leak between cases.
function makeClient(count: number | null, userId: string) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ count, error: null }),
  });
  const from = vi.fn().mockReturnValue({ select, insert });
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } } }),
      },
      from,
    },
    insert,
  };
}

describe("seedDefaultAreas (TASK-011)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts the four default areas when none exist", async () => {
    const { client, insert } = makeClient(0, "user-empty");
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
    expect(
      rows.every((r: { user_id: string }) => r.user_id === "user-empty"),
    ).toBe(true);
  });

  it("does nothing when areas already exist", async () => {
    const { client, insert } = makeClient(4, "user-existing");
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultAreas();

    expect(insert).not.toHaveBeenCalled();
  });

  it("skips the existence query on the second call for the same user (memo)", async () => {
    const { client, insert } = makeClient(0, "user-memo");
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultAreas();
    await seedDefaultAreas();

    // Seeded once; the second call short-circuits via the memo.
    expect(insert).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(2); // count + insert, not 3+
  });
});
