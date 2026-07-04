import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { seedDefaultExercises } from "./seed";
import { DEFAULT_EXERCISES } from "./types";

// Chainable supabase mock: preset count + captured inserts. Distinct userId per
// test so the per-instance "ensured" memo doesn't leak between cases.
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

describe("seedDefaultExercises", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts the default exercise library when none exist", async () => {
    const { client, insert } = makeClient(0, "user-empty");
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultExercises();

    expect(insert).toHaveBeenCalledTimes(1);
    const rows = insert.mock.calls[0][0];
    expect(rows).toHaveLength(DEFAULT_EXERCISES.length);
    expect(
      rows.every(
        (r: { user_id: string; is_default: boolean }) =>
          r.user_id === "user-empty" && r.is_default === true,
      ),
    ).toBe(true);
    // Enthält Hyrox-Stationen und Kraftübungen.
    const names = rows.map((r: { name: string }) => r.name);
    expect(names).toContain("Wall Balls");
    expect(names).toContain("Kniebeuge");
  });

  it("does nothing when exercises already exist", async () => {
    const { client, insert } = makeClient(12, "user-existing");
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultExercises();

    expect(insert).not.toHaveBeenCalled();
  });

  it("skips the existence query on the second call for the same user (memo)", async () => {
    const { client, insert } = makeClient(0, "user-memo");
    mocks.createClient.mockResolvedValue(client);

    await seedDefaultExercises();
    await seedDefaultExercises();

    expect(insert).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(2); // count + insert, not 3+
  });
});
