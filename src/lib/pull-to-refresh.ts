/**
 * Pure helpers for the pull-to-refresh gesture (TASK: iOS PWA). Kept DOM-free so
 * the damping curve and phase transitions are unit-testable without touch events.
 */

export const PULL_THRESHOLD_PX = 64;
export const MAX_PULL_PX = 96;

/**
 * iOS-style rubber-band resistance: approaches maxPull asymptotically as
 * rawDeltaY grows, so the indicator never overshoots the visible travel range.
 */
export function dampPull(
  rawDeltaY: number,
  maxPull: number = MAX_PULL_PX,
  resistance = 2.2,
): number {
  if (rawDeltaY <= 0) return 0;
  return maxPull * (1 - 1 / (rawDeltaY / (maxPull * resistance) + 1));
}

export type PullPhase = "idle" | "pulling" | "ready" | "refreshing";

export function getPullPhase(
  damped: number,
  isRefreshing: boolean,
  threshold: number = PULL_THRESHOLD_PX,
): PullPhase {
  if (isRefreshing) return "refreshing";
  if (damped <= 0) return "idle";
  return damped >= threshold ? "ready" : "pulling";
}
