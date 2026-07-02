import { beforeEach, describe, expect, it, vi } from "vitest";
import { percentile } from "./summary";

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

describe("percentile (TASK-057)", () => {
  it("returns null for an empty sample", () => {
    expect(percentile([], 95)).toBeNull();
  });
  it("uses nearest-rank p95", () => {
    expect(percentile([1000, 2000, 4000, 6000], 95)).toBe(6000);
    expect(percentile([5], 95)).toBe(5);
  });
});

describe("metricsSummary (TASK-057)", () => {
  beforeEach(() => {
    mocks.createClient.mockResolvedValue(makeClient());
  });

  it("derives capture, voice, correction and latency metrics", async () => {
    const day = "2026-07-01T09:00:00.000Z";
    mocks.rows = [
      { source: "pwa_voice", status: "classified", corrected_at: null, created_at: day, ai_meta: { total_ms: 2000 } },
      { source: "pwa_text", status: "classified", corrected_at: day, created_at: day, ai_meta: { total_ms: 4000 } },
      { source: "ios_shortcut", status: "classified", corrected_at: null, created_at: day, ai_meta: { total_ms: 6000 } },
      { source: "pwa_text", status: "failed", corrected_at: null, created_at: day, ai_meta: { total_ms: 1000 } },
    ];

    const m = await metricsSummary(
      new Date("2026-07-01T10:00:00.000Z"),
      "Europe/Berlin",
    );

    expect(m.capturesToday).toBe(4);
    expect(m.voiceCaptures).toBe(2);
    expect(m.textCaptures).toBe(2);
    expect(m.voiceSharePct).toBe(50);
    expect(m.classifiedCount).toBe(3);
    expect(m.correctedCount).toBe(1);
    expect(m.correctionRatePct).toBe(33);
    expect(m.failureRatePct).toBe(25);
    expect(m.captureP95Ms).toBe(6000);
  });

  it("returns the empty summary when there are no captures", async () => {
    mocks.rows = [];
    const m = await metricsSummary(new Date("2026-07-01T10:00:00.000Z"));
    expect(m.capturesInWindow).toBe(0);
    expect(m.correctionRatePct).toBeNull();
    expect(m.captureP95Ms).toBeNull();
  });
});
