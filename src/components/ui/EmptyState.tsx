import type { ReactNode } from "react";

/**
 * Shared empty state (TASK-049). One consistent voice for "nothing here yet"
 * across every screen: a terse title, an optional inviting hint, and an
 * optional action. Copy stays in the Atlas voice — knapp, ohne Floskeln, ohne
 * Emoji (Vision § Voice & Tone). Presentational only, so it renders in server
 * or client components alike.
 */
export default function EmptyState({
  title,
  hint,
  action,
  className = "",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-8 ${className}`}>
      <p className="text-body text-on-surface">{title}</p>
      {hint && (
        <p className="mt-1 text-body-sm text-on-surface-muted">{hint}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
