import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rows: [] as unknown[],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        gte: () => q,
        then: (res: (v: unknown) => void) =>
          res({ data: mocks.rows, error: null }),
      };
      return q;
    },
  };
}

import { metricsSummary } from "./summary";

describe("metricsSummary (TASK-057)", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(makeClient());
  });

  it("derives capture, voice and failure metrics", async () => {
    const day = "2026-07-01T09:00:00.000Z";
    mocks.rows = [
      { source: "pwa_voice", status: "classified", created_at: day },
      { source: "pwa_text", status: "classified", created_at: day },
      { source: "ios_shortcut", status: "classified", created_at: day },
      { source: "pwa_text", status: "failed", created_at: day },
    ];

    const m = await metricsSummary(
      new Date("2026-07-01T10:00:00.000Z"),
      "Europe/Berlin",
    );

    expect(m.capturesToday).toBe(4);
    expect(m.voiceCaptures).toBe(2);
    expect(m.textCaptures).toBe(2);
    expect(m.voiceSharePct).toBe(50);
    expect(m.failureRatePct).toBe(25);
  });

  it("returns the empty summary when there are no captures", async () => {
    mocks.rows = [];
    const m = await metricsSummary(new Date("2026-07-01T10:00:00.000Z"));
    expect(m.capturesInWindow).toBe(0);
    expect(m.failureRatePct).toBeNull();
  });
});
