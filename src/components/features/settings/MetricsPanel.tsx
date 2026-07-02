import type { MetricsSummary } from "@/lib/metrics/summary";

/**
 * Success-metrics panel (TASK-057, Vision § Success Metrics). Read-only view of
 * the numbers that tell whether Atlas has become the default capture spot:
 * capture volume, AI correction rate, voice share and capture p95. The Vision
 * thresholds (good / great) ride along as quiet Mono context. Presentational —
 * the data comes from metricsSummary() in the Settings server component.
 */

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <li className="flex items-baseline gap-3 border-b border-border py-3">
      <span className="flex-1 text-body text-on-surface">{label}</span>
      <span className="font-serif text-subtitle text-on-surface">{value}</span>
      {hint && (
        <span className="w-28 shrink-0 text-right font-mono text-meta uppercase tracking-label text-on-surface-muted">
          {hint}
        </span>
      )}
    </li>
  );
}

function pct(v: number | null): string {
  return v == null ? "—" : `${v} %`;
}

function seconds(ms: number | null): string {
  return ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`;
}

export default function MetricsPanel({ data }: { data: MetricsSummary }) {
  return (
    <section className="mt-8">
      <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
        Insights
      </p>
      <p className="mt-1 font-mono text-meta uppercase tracking-label text-on-surface-muted">
        Letzte {data.windowDays} Tage
      </p>

      <ul className="mt-3">
        <Row
          label="Captures heute"
          value={String(data.capturesToday)}
          hint="gut ≥3 · top ≥8"
        />
        <Row label="Ø Captures / Tag" value={data.avgPerDay.toFixed(1)} />
        <Row label="Voice-Anteil" value={pct(data.voiceSharePct)} />
        <Row
          label="KI-Korrekturrate"
          value={pct(data.correctionRatePct)}
          hint="gut <20 · top <10"
        />
        <Row
          label="Capture p95"
          value={seconds(data.captureP95Ms)}
          hint="gut <5s · top <3s"
        />
        <Row label="Fehlerrate" value={pct(data.failureRatePct)} />
      </ul>
    </section>
  );
}
