/**
 * Streak history (TASK-034). Lightweight — no chart library. Renders the last
 * ~30 days as a row of small squares (filled = done) plus the design's streak
 * indicator (flame + number). Deliberately sober: no confetti/animation
 * (docs/design.md § Don'ts — "Streaks bleiben sachlich").
 */

export function StreakIndicator({
  streak,
  unit = "Tage",
}: {
  streak: number;
  /** Streak unit — "Tage" for daily routines, "Wochen" for weekly ones. */
  unit?: "Tage" | "Wochen";
}) {
  const active = streak > 0;
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-meta uppercase tracking-label"
      aria-label={`Streak ${streak} ${unit}`}
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

/** Current-week progress for a weekly routine, e.g. "3/4 diese Woche". */
export function WeeklyProgress({
  done,
  target,
}: {
  done: number;
  target: number;
}) {
  return (
    <span
      className="font-mono text-meta uppercase tracking-label text-on-surface-muted"
      aria-label={`${done} von ${target} diese Woche`}
    >
      {done}/{target} diese Woche
    </span>
  );
}

export default function StreakChart({
  days,
  streak,
  weeklyProgress,
}: {
  days: { date: string; done: boolean }[];
  streak?: number;
  /** Present for weekly routines → shows "N/target diese Woche" + week streak. */
  weeklyProgress?: { done: number; target: number } | null;
}) {
  const weekly = weeklyProgress != null;
  return (
    <div className="flex flex-wrap items-center gap-3">
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
      {weekly && (
        <WeeklyProgress
          done={weeklyProgress.done}
          target={weeklyProgress.target}
        />
      )}
      {streak !== undefined && (
        <StreakIndicator streak={streak} unit={weekly ? "Wochen" : "Tage"} />
      )}
    </div>
  );
}
