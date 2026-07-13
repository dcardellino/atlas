import { useEffect, useRef, useState, type RefObject } from "react";
import { dampPull, getPullPhase, PULL_THRESHOLD_PX } from "@/lib/pull-to-refresh";

interface UsePullToRefreshOptions {
  containerRef: RefObject<HTMLElement | null>;
  onRefresh: () => void;
  isRefreshing: boolean;
  disabled?: boolean;
}

const DRAG_SLOP_PX = 10;

/**
 * Touch-driven pull-to-refresh gesture, scoped to `containerRef` so it never
 * sees touches on siblings (sticky Nav, QuickCapture/ConfirmDialog overlays).
 * Bails out of tracking a touch that starts on anything with a non-"auto"
 * touch-action (dnd-kit drag handles use `touch-none`), so it never fights
 * another gesture handler.
 */
export function usePullToRefresh({
  containerRef,
  onRefresh,
  isRefreshing,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(pull);
  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(isRefreshing);

  useEffect(() => {
    pullRef.current = pull;
    onRefreshRef.current = onRefresh;
    isRefreshingRef.current = isRefreshing;
  });

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const trackingRef = useRef(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    function isInsideNonPannable(target: EventTarget | null) {
      let node = target instanceof Element ? target : null;
      while (node && node !== el) {
        if (getComputedStyle(node).touchAction !== "auto") return true;
        node = node.parentElement;
      }
      return false;
    }

    function reset() {
      trackingRef.current = false;
      draggingRef.current = false;
      startRef.current = null;
    }

    function onTouchStart(e: TouchEvent) {
      if (isRefreshingRef.current || window.scrollY > 0) return;
      if (isInsideNonPannable(e.target)) return;
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
      trackingRef.current = true;
      draggingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!trackingRef.current || !startRef.current) return;
      if (window.scrollY > 0) {
        reset();
        setPull(0);
        return;
      }

      const touch = e.touches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;

      if (!draggingRef.current) {
        if (Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal intent — leave it for whatever else wants this swipe.
          reset();
          return;
        }
        draggingRef.current = true;
      }

      if (dy <= 0) {
        setPull(0);
        return;
      }

      e.preventDefault();
      setPull(dampPull(dy));
    }

    function onTouchEnd() {
      if (!trackingRef.current) return;
      const wasReady = getPullPhase(pullRef.current, false) === "ready";
      reset();
      if (wasReady) {
        setPull(PULL_THRESHOLD_PX);
        onRefreshRef.current();
      } else {
        setPull(0);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, disabled]);

  const prevRefreshingRef = useRef(isRefreshing);
  useEffect(() => {
    if (prevRefreshingRef.current && !isRefreshing) {
      setPull(0);
    }
    prevRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  return { pull, phase: getPullPhase(pull, isRefreshing) };
}
