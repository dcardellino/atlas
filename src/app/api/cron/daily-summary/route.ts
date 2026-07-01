import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { sendTelegram } from "@/lib/notify/telegram";
import { dayBoundsUtc } from "@/lib/time/day";

/**
 * Daily-summary cron (TASK-043, FR-009). Sends a short morning digest via
 * Telegram — how many tasks are due today and how many routines are active.
 * Single-user MVP: one chat, so counts are aggregated across the (one) user.
 * System-side admin client; secured by CRON_SECRET. Scheduled ~06:00.
 */
export const dynamic = "force-dynamic";

const TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const [startUtc, endUtc] = dayBoundsUtc(new Date(), TZ);

  const [dueRes, routinesRes] = await Promise.all([
    db
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("due_at", startUtc)
      .lt("due_at", endUtc),
    db
      .from("routines")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null),
  ]);

  const dueCount = dueRes.count ?? 0;
  const routineCount = routinesRes.count ?? 0;

  const body =
    `${dueCount} ${dueCount === 1 ? "Aufgabe" : "Aufgaben"} heute fällig · ` +
    `${routineCount} ${routineCount === 1 ? "Routine" : "Routinen"} aktiv`;

  const ok = await sendTelegram({ title: "🌅 Guten Morgen", body });

  return NextResponse.json({ sent: ok, dueCount, routineCount });
}
