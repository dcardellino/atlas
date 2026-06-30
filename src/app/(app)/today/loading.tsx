// Today loading state (TASK-021): skeleton cards, not a spinner (PRD § UI/UX).
export default function TodayLoading() {
  return (
    <section>
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Heute
      </p>
      <h1 className="mt-1 font-serif text-display text-on-surface">Today</h1>
      <div className="mt-8 space-y-3" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-sm bg-surface-raised"
          />
        ))}
      </div>
    </section>
  );
}
