import { createClient } from "@/lib/supabase/server";
import { dayBoundsUtc } from "@/lib/time/day";

/**
 * Success-metrics aggregation (TASK-057, Vision § Success Metrics). Mirrors the
 * shape of today/summary.ts: a single server function, scoped to the signed-in
 * user, returning a typed summary. Everything is derived from `inbox_items`:
 *
 *  - daily capture count (today + recent daily average) — primary metric
 *  - AI correction rate — corrected ÷ classified (the corrected_* columns from 0007)
 *  - voice:text ratio — from `source`
 *  - capture p95 latency — percentile over `ai_meta.total_ms`, computed in JS
 *    (Supabase JS has no percentile aggregate)
 *  - failure rate — status = 'failed'
 *
 * Single-user scale: reads a bounded recent window (default 30 days).
 */

const WINDOW_DAYS = 30;

export type MetricsSummary = {
  windowDays: number;
  capturesToday: number;
  capturesInWindow: number;
  avgPerDay: number;
  voiceCaptures: number;
  textCaptures: number;
  voiceSharePct: number | null;
  classifiedCount: number;
  correctedCount: number;
  correctionRatePct: number | null;
  failureCount: number;
  failureRatePct: number | null;
  captureP95Ms: number | null;
  sampleSize: number;
};

const VOICE_SOURCES = new Set(["pwa_voice", "ios_shortcut"]);

type InboxRow = {
  source: string | null;
  status: string | null;
  corrected_at: string | null;
  created_at: string;
  ai_meta: { total_ms?: number } | null;
};

/** p95 of a numeric sample (nearest-rank), or null when empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

const EMPTY: MetricsSummary = {
  windowDays: WINDOW_DAYS,
  capturesToday: 0,
  capturesInWindow: 0,
  avgPerDay: 0,
  voiceCaptures: 0,
  textCaptures: 0,
  voiceSharePct: null,
  classifiedCount: 0,
  correctedCount: 0,
  correctionRatePct: null,
  failureCount: 0,
  failureRatePct: null,
  captureP95Ms: null,
  sampleSize: 0,
};

export async function metricsSummary(
  now: Date = new Date(),
  tz: string = process.env.CAPTURE_TZ ?? "Europe/Berlin",
): Promise<MetricsSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const windowStart = new Date(
    now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [todayStart, todayEnd] = dayBoundsUtc(now, tz);

  const { data } = await supabase
    .from("inbox_items")
    .select("source, status, corrected_at, created_at, ai_meta")
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  const rows = (data as InboxRow[]) ?? [];
  if (rows.length === 0) return EMPTY;

  let capturesToday = 0;
  let voiceCaptures = 0;
  let textCaptures = 0;
  let classifiedCount = 0;
  let correctedCount = 0;
  let failureCount = 0;
  const latencies: number[] = [];

  for (const r of rows) {
    if (r.created_at >= todayStart && r.created_at < todayEnd) capturesToday++;
    if (r.source && VOICE_SOURCES.has(r.source)) voiceCaptures++;
    else if (r.source === "pwa_text") textCaptures++;
    if (r.status === "classified") classifiedCount++;
    if (r.status === "failed") failureCount++;
    if (r.corrected_at) correctedCount++;
    const ms = r.ai_meta?.total_ms;
    if (typeof ms === "number" && ms > 0) latencies.push(ms);
  }

  const voiceText = voiceCaptures + textCaptures;
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

  return {
    windowDays: WINDOW_DAYS,
    capturesToday,
    capturesInWindow: rows.length,
    avgPerDay: Math.round((rows.length / WINDOW_DAYS) * 10) / 10,
    voiceCaptures,
    textCaptures,
    voiceSharePct: pct(voiceCaptures, voiceText),
    classifiedCount,
    correctedCount,
    correctionRatePct: pct(correctedCount, classifiedCount),
    failureCount,
    failureRatePct: pct(failureCount, rows.length),
    captureP95Ms: percentile(latencies, 95),
    sampleSize: latencies.length,
  };
}
