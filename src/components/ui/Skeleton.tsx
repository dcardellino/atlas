/**
 * Loading skeletons (TASK-050). Skeleton cards, never spinners (PRD § UI/UX).
 * The base block lifts the pattern first used in today/loading.tsx; `SkeletonList`
 * and `SkeletonScreen` compose it so each route's loading.tsx stays a one-liner
 * with a header that matches its populated screen. Purely decorative → aria-hidden.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-surface-raised ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mt-8 space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

/**
 * Full screen skeleton with the standard eyebrow + serif title header, so the
 * loading state visually anchors to the same spot as the loaded screen.
 */
export function SkeletonScreen({
  eyebrow,
  title,
  rows = 5,
}: {
  eyebrow: string;
  title: string;
  rows?: number;
}) {
  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        {eyebrow}
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">{title}</h1>
      <SkeletonList rows={rows} />
    </section>
  );
}
