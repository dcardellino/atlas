import { describe, expect, it } from "vitest";
import {
  dampPull,
  getPullPhase,
  MAX_PULL_PX,
  PULL_THRESHOLD_PX,
} from "./pull-to-refresh";

describe("dampPull", () => {
  it("returns 0 for non-positive deltas", () => {
    expect(dampPull(0)).toBe(0);
    expect(dampPull(-40)).toBe(0);
  });

  it("grows monotonically with rawDeltaY", () => {
    const a = dampPull(20);
    const b = dampPull(60);
    const c = dampPull(160);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it("never exceeds maxPull, even for very large deltas", () => {
    expect(dampPull(10_000)).toBeLessThan(MAX_PULL_PX);
    expect(dampPull(10_000, MAX_PULL_PX)).toBeGreaterThan(MAX_PULL_PX * 0.9);
  });

  it("damps less than a 1:1 finger drag once past the slop", () => {
    expect(dampPull(60)).toBeLessThan(60);
  });
});

describe("getPullPhase", () => {
  it("is idle at rest", () => {
    expect(getPullPhase(0, false)).toBe("idle");
  });

  it("is pulling below the threshold", () => {
    expect(getPullPhase(PULL_THRESHOLD_PX - 1, false)).toBe("pulling");
  });

  it("is ready at or above the threshold", () => {
    expect(getPullPhase(PULL_THRESHOLD_PX, false)).toBe("ready");
    expect(getPullPhase(PULL_THRESHOLD_PX + 10, false)).toBe("ready");
  });

  it("is refreshing whenever isRefreshing is true, regardless of pull", () => {
    expect(getPullPhase(0, true)).toBe("refreshing");
    expect(getPullPhase(PULL_THRESHOLD_PX, true)).toBe("refreshing");
  });
});
