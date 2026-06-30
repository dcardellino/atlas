/**
 * Streak history (TASK-034). Lightweight — no chart library. Renders the last
 * ~30 days as a row of small squares (filled = done) plus the design's streak
 * indicator (flame + number). Deliberately sober: no confetti/animation
 * (docs/design.md § Don'ts — "Streaks bleiben sachlich").
 */

export function StreakIndicator({ streak }: { streak: number }) {
  const active = streak > 0;
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-meta uppercase tracking-label"
      aria-label={`Streak ${streak} Tage`}
    >
      <span className={active ? "text-accent" : "text-on-surface-muted"}>
        ▲
      </span>
      <span className={active ? "text-on-surface" : "text-on-surface-muted"}>
        {streak}
      </span>
    </span>
  );
}

export default function StreakChart({
  days,
  streak,
}: {
  days: { date: string; done: boolean }[];
  streak?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-wrap gap-[2px]" aria-hidden>
        {days.map((d) => (
          <span
            key={d.date}
            title={d.date}
            className={`h-2 w-2 rounded-sm ${
              d.done ? "bg-on-surface" : "border border-border bg-surface"
            }`}
          />
        ))}
      </div>
      {streak !== undefined && <StreakIndicator streak={streak} />}
    </div>
  );
}
