"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/lib/hooks/usePullToRefresh";
import { PULL_THRESHOLD_PX } from "@/lib/pull-to-refresh";

/**
 * Pull-to-refresh for the authenticated app shell (iOS has no native gesture
 * in standalone/home-screen mode). Wraps the current route's Server Component
 * output; releasing past the threshold calls `router.refresh()`, the same
 * "refresh the current view" idiom used elsewhere (e.g. IntegrationStatus).
 *
 * No spinner (docs/design.md bans them) — a chevron rotates as you pull, and
 * the release state reuses the mono uppercase label style from Nav.
 */
export default function PullToRefresh({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const { pull, phase } = usePullToRefresh({
    containerRef,
    isRefreshing: pending,
    onRefresh: () => startTransition(() => router.refresh()),
  });

  return (
    <div ref={containerRef} className="relative">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1 text-accent transition-opacity"
        style={{
          top: "calc(env(safe-area-inset-top) + 8px)",
          opacity: phase === "idle" ? 0 : Math.min(pull / PULL_THRESHOLD_PX, 1),
        }}
      >
        {phase === "refreshing" ? (
          <span className="animate-pulse font-mono text-meta uppercase tracking-label">
            Aktualisiere…
          </span>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{
              transform: `rotate(${phase === "ready" ? 180 : 0}deg)`,
              transition: "transform 150ms ease-out",
            }}
          >
            <path
              d="M4 7l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {phase === "refreshing" ? "Aktualisiere…" : ""}
      </p>

      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition:
            pull === 0 || phase === "refreshing"
              ? "transform 200ms ease-out"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
