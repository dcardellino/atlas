import { createClient } from "@/lib/supabase/server";
import { dayBoundsUtc } from "@/lib/time/day";

/**
 * Success-metrics aggregation (TASK-057, Vision § Success Metrics). Mirrors the
 * shape of today/summary.ts: a single server function, scoped to the signed-in
 * user, returning a typed summary. Everything is derived from `inbox_items`:
 *
 *  - daily capture count (today + recent daily average) — primary metric
 *  - voice:text ratio — from `source`
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
  failureCount: number;
  failureRatePct: number | null;
};

const VOICE_SOURCES = new Set(["pwa_voice", "ios_shortcut"]);

type InboxRow = {
  source: string | null;
  status: string | null;
  created_at: string;
};


const EMPTY: MetricsSummary = {
  windowDays: WINDOW_DAYS,
  capturesToday: 0,
  capturesInWindow: 0,
  avgPerDay: 0,
  voiceCaptures: 0,
  textCaptures: 0,
  voiceSharePct: null,
  failureCount: 0,
  failureRatePct: null,
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
    .select("source, status, created_at")
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  const rows = (data as InboxRow[]) ?? [];
  if (rows.length === 0) return EMPTY;

  let capturesToday = 0;
  let voiceCaptures = 0;
  let textCaptures = 0;
  let failureCount = 0;

  for (const r of rows) {
    if (r.created_at >= todayStart && r.created_at < todayEnd) capturesToday++;
    if (r.source && VOICE_SOURCES.has(r.source)) voiceCaptures++;
    else if (r.source === "pwa_text") textCaptures++;
    if (r.status === "failed") failureCount++;
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
    failureCount,
    failureRatePct: pct(failureCount, rows.length),
  };
}
