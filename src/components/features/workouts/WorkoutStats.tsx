"use client";

import { useMemo, useState } from "react";
import type { PersonalRecord } from "@/lib/workouts/stats";
import EmptyState from "@/components/ui/EmptyState";

/**
 * Workout-Statistik. Bewusst ohne Chart-Library — schlichte, hand-gerollte SVGs
 * im Stil von StreakChart.tsx (docs/design.md § Streaks bleiben sachlich).
 * Frequenz + Volumen als Balken, Progression/Stationszeiten als Linie mit
 * Auswahl, plus die abgeleiteten persönlichen Rekorde.
 */

type Point = { label: string; value: number };
type Series = { date: string; value: number };

const meta = "font-mono text-meta uppercase tracking-label text-on-surface-muted";
const label = "font-mono text-label uppercase tracking-label text-on-surface-muted";

function BarChart({ points, unit }: { points: Point[]; unit?: string }) {
  if (points.length === 0) return <p className={meta}>Keine Daten.</p>;
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 100;
  const gap = 2;
  const barW = (w - gap * (points.length - 1)) / points.length;
  return (
    <svg viewBox={`0 0 ${w} 40`} className="mt-2 w-full" role="img" aria-label="Balkendiagramm">
      {points.map((p, i) => {
        const h = (p.value / max) * 34;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={38 - h}
            width={barW}
            height={Math.max(h, 0.5)}
            className="fill-accent"
          >
            <title>{`${p.label}: ${p.value}${unit ?? ""}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function LineChart({ series, unit }: { series: Series[]; unit?: string }) {
  if (series.length === 0) return <p className={meta}>Keine Daten.</p>;
  if (series.length === 1) {
    return (
      <p className="mt-2 text-body text-on-surface">
        {series[0].value}
        {unit ?? ""} · {series[0].date}
      </p>
    );
  }
  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 100;
  const h = 40;
  const step = w / (series.length - 1);
  const pts = series.map((s, i) => {
    const x = i * step;
    const y = h - 4 - ((s.value - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" role="img" aria-label="Liniendiagramm">
      <polyline
        points={pts.join(" ")}
        fill="none"
        className="stroke-accent"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {series.map((s, i) => {
        const [x, y] = pts[i].split(",").map(Number);
        return (
          <circle key={i} cx={x} cy={y} r="1.4" className="fill-on-surface">
            <title>{`${s.date}: ${s.value}${unit ?? ""}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutStats({
  frequency,
  volume,
  prs,
  progression,
  stationTimes,
}: {
  frequency: { week: string; count: number }[];
  volume: { date: string; volume: number }[];
  prs: PersonalRecord[];
  progression: Record<string, { date: string; estOneRepMax: number }[]>;
  stationTimes: Record<string, { date: string; bestSeconds: number }[]>;
}) {
  const progressionNames = Object.keys(progression).sort((a, b) =>
    a.localeCompare(b),
  );
  const stationNames = Object.keys(stationTimes).sort((a, b) =>
    a.localeCompare(b),
  );
  const [exName, setExName] = useState(progressionNames[0] ?? "");
  const [stName, setStName] = useState(stationNames[0] ?? "");

  const hasData =
    frequency.length > 0 || volume.length > 0 || prs.length > 0;

  const freqPoints = useMemo(
    () => frequency.map((f) => ({ label: f.week, value: f.count })),
    [frequency],
  );
  const volPoints = useMemo(
    () => volume.map((v) => ({ label: v.date, value: v.volume })),
    [volume],
  );

  if (!hasData) {
    return (
      <EmptyState
        title="Noch keine Statistik"
        hint="Sobald du Workouts protokollierst, erscheinen hier Frequenz, Volumen und Rekorde."
      />
    );
  }

  const selectCls =
    "rounded-sm border border-border bg-surface px-2 py-1 font-mono text-meta text-on-surface outline-none focus:border-accent";

  return (
    <div className="mt-6 space-y-8">
      <section>
        <p className={label}>Trainingsfrequenz / Woche</p>
        <BarChart points={freqPoints} />
        <p className={`mt-1 ${meta}`}>
          {frequency.reduce((a, f) => a + f.count, 0)} Workouts insgesamt
        </p>
      </section>

      <section>
        <p className={label}>Volumen / Einheit (kg)</p>
        <BarChart points={volPoints} unit=" kg" />
      </section>

      {progressionNames.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-2">
            <p className={label}>Progression (geschätztes 1RM)</p>
            <select
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              className={selectCls}
              aria-label="Übung"
            >
              {progressionNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <LineChart
            series={(progression[exName] ?? []).map((p) => ({
              date: p.date,
              value: p.estOneRepMax,
            }))}
            unit=" kg"
          />
        </section>
      )}

      {stationNames.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-2">
            <p className={label}>Hyrox-Stationszeiten</p>
            <select
              value={stName}
              onChange={(e) => setStName(e.target.value)}
              className={selectCls}
              aria-label="Station"
            >
              {stationNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <LineChart
            series={(stationTimes[stName] ?? []).map((p) => ({
              date: p.date,
              value: p.bestSeconds,
            }))}
            unit=" s"
          />
        </section>
      )}

      {prs.length > 0 && (
        <section>
          <p className={label}>Persönliche Rekorde</p>
          <ul className="mt-2">
            {prs.map((pr) => (
              <li
                key={pr.exercise_name}
                className="flex items-baseline justify-between gap-3 border-b border-border py-2"
              >
                <span className="min-w-0 truncate text-body-sm text-on-surface">
                  {pr.exercise_name}
                </span>
                <span className="shrink-0 text-body-sm text-on-surface-muted">
                  {[
                    pr.maxWeight != null ? `${pr.maxWeight} kg` : null,
                    pr.bestEstOneRepMax != null
                      ? `1RM≈${pr.bestEstOneRepMax}`
                      : null,
                    pr.maxReps != null ? `${pr.maxReps} Wdh.` : null,
                    pr.maxDistance != null ? `${pr.maxDistance} m` : null,
                    pr.bestSeconds != null ? formatTime(pr.bestSeconds) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
