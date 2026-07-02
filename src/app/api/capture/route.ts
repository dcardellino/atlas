import { NextResponse, type NextRequest } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerFromHeader, resolveToken } from "@/lib/auth/token";
import { CaptureInputSchema } from "@/lib/schemas/capture";
import { classify, CLASSIFY_MODEL, type AreaContext } from "@/lib/ai/classify";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Capture endpoint (TASK-014 / FR-001, latency logging TASK-024).
 *
 * The magic moment: raw text in → classified entry out, in under 5s. Order is
 * chosen so a classifier failure can never lose data (PRD § Reliability):
 *   1. persist inbox_item (status=pending) with the raw text
 *   2. classify
 *   3. create the target entry (task | journal; note stays as the inbox item)
 *   4. mark the inbox_item classified (or failed → 207 note fallback)
 *
 * Auth: a Supabase session (PWA) OR a Bearer token (iOS shortcut). Session
 * inserts run under RLS; token inserts use the admin client with an explicit
 * user_id resolved from the token. user_id is always set explicitly either way.
 */

type Auth = { userId: string; db: SupabaseClient };
type AuthOutcome =
  | { ok: true; auth: Auth }
  | { ok: false; reason: "invalid" | "revoked" | "expired" }
  | null;

// Simple in-memory rate limit: 60 requests / minute / user. Per-instance only —
// adequate for a single-user MVP (PRD § Security suggests 60/min).
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string, now: number): boolean {
  const recent = (hits.get(userId) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

const CAPTURE_TZ = process.env.CAPTURE_TZ ?? "Europe/Berlin";

/**
 * Derive a routine's time-of-day grouping and specific time from a captured
 * due time, if any. Routines usually carry no time → "anytime" (TASK-035).
 */
function routineTiming(dueAt: string | null | undefined): {
  time_of_day: "morning" | "afternoon" | "evening" | "anytime";
  specific_time: string | null;
} {
  if (!dueAt) return { time_of_day: "anytime", specific_time: null };
  const date = new Date(dueAt);
  const hour = Number(formatInTimeZone(date, CAPTURE_TZ, "H"));
  const specific_time = formatInTimeZone(date, CAPTURE_TZ, "HH:mm:ss");
  const time_of_day =
    hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return { time_of_day, specific_time };
}

async function authenticate(request: NextRequest): Promise<AuthOutcome> {
  // 1. Supabase session (PWA quick capture).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { ok: true, auth: { userId: user.id, db: supabase } };

  // 2. Bearer token (iOS shortcut) → admin client + explicit user_id.
  const token = bearerFromHeader(request.headers.get("authorization"));
  if (!token) return null;

  const result = await resolveToken(token);
  if (result.ok) {
    return { ok: true, auth: { userId: result.userId, db: createAdminClient() } };
  }
  // Unknown token is indistinguishable from "no auth" → generic 401; a known but
  // revoked/expired token gets a specific hint (Edge Cases: Token neu erzeugen).
  return result.reason === "invalid" ? null : { ok: false, reason: result.reason };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const authResult = await authenticate(request);
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!authResult.ok) {
    // Known token that is no longer usable — tell the shortcut to re-issue one.
    return NextResponse.json(
      {
        error: authResult.reason === "expired" ? "token expired" : "token revoked",
        hint: "Token ist ungültig — im Web ein neues erzeugen.",
      },
      { status: 401 },
    );
  }
  const auth = authResult.auth;

  if (rateLimited(auth.userId, startedAt)) {
    // Retry-After: whole seconds until the sliding window frees a slot.
    return NextResponse.json(
      { error: "rate limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(RATE_WINDOW_MS / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid input", details: "body is not JSON" },
      { status: 400 },
    );
  }

  const parsed = CaptureInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { text, source } = parsed.data;
  const { userId, db } = auth;

  // 1. Persist the raw capture first — never lose data.
  const { data: inbox, error: inboxError } = await db
    .from("inbox_items")
    .insert({ user_id: userId, raw_text: text, source, status: "pending" })
    .select("id")
    .single();

  if (inboxError || !inbox) {
    return NextResponse.json(
      { error: "could not persist capture", details: inboxError?.message },
      { status: 500 },
    );
  }

  // 2. Load the user's areas as classification context.
  const { data: areaRows } = await db
    .from("areas")
    .select("id, slug, name")
    .eq("user_id", userId);
  const areas: AreaContext[] = (areaRows ?? []).map((a) => ({
    slug: a.slug,
    name: a.name,
  }));

  // 3. Classify. On any failure, fall back to keeping the capture as a note.
  let classification;
  let classifyMs: number;
  try {
    const t0 = Date.now();
    classification = await classify(text, areas);
    classifyMs = Date.now() - t0;
  } catch (err) {
    await db
      .from("inbox_items")
      .update({
        status: "failed",
        classified_type: "note",
        ai_meta: {
          model: CLASSIFY_MODEL,
          error: err instanceof Error ? err.message : String(err),
          total_ms: Date.now() - startedAt,
        },
      })
      .eq("id", inbox.id);

    return NextResponse.json(
      { type: "note", id: inbox.id, note: "unklassifiziert, in Inbox" },
      { status: 207 },
    );
  }

  const areaRow = classification.area_slug
    ? (areaRows ?? []).find((a) => a.slug === classification.area_slug)
    : undefined;
  const areaId = areaRow?.id ?? null;

  // 4. Create the target entry. task → tasks, routine → routines (TASK-035),
  // journal → journal_entries; 'note' stays as the inbox item itself.
  let createdId = inbox.id;
  let targetError: string | null = null;

  if (classification.type === "task") {
    const { data: task, error } = await db
      .from("tasks")
      .insert({
        user_id: userId,
        area_id: areaId,
        title: classification.title,
        due_at: classification.due_at ?? null,
        source_inbox_id: inbox.id,
      })
      .select("id")
      .single();
    if (task) createdId = task.id;
    else targetError = error?.message ?? "task insert failed";
  } else if (classification.type === "routine") {
    // `routines` has no source_inbox_id; the inbox item's classified_into below
    // preserves the link back to this routine.
    const { time_of_day, specific_time } = routineTiming(classification.due_at);
    const { data: routine, error } = await db
      .from("routines")
      .insert({
        user_id: userId,
        area_id: areaId,
        name: classification.title,
        time_of_day,
        specific_time,
      })
      .select("id")
      .single();
    if (routine) createdId = routine.id;
    else targetError = error?.message ?? "routine insert failed";
  } else if (classification.type === "journal") {
    const { data: entry, error } = await db
      .from("journal_entries")
      .insert({
        user_id: userId,
        area_id: areaId,
        body: text,
        source,
        source_inbox_id: inbox.id,
      })
      .select("id")
      .single();
    if (entry) createdId = entry.id;
    else targetError = error?.message ?? "journal insert failed";
  }
  // 'note' → no separate row; the inbox_item itself is the note.

  // 4b. If the target row could not be created, don't pretend success (which
  // previously returned a 201 pointing at the inbox id). Keep the raw text as an
  // inbox note (no data loss) and report 207 so the client can flag it.
  if (targetError) {
    await db
      .from("inbox_items")
      .update({
        status: "failed",
        classified_type: "note",
        ai_meta: {
          model: CLASSIFY_MODEL,
          classification,
          classify_ms: classifyMs,
          error: targetError,
          total_ms: Date.now() - startedAt,
        },
      })
      .eq("id", inbox.id);

    return NextResponse.json(
      { type: "note", id: inbox.id, note: "konnte nicht einsortiert werden, in Inbox" },
      { status: 207 },
    );
  }

  // 5. Mark the inbox item classified, with timings (TASK-024).
  const { error: updateError } = await db
    .from("inbox_items")
    .update({
      status: "classified",
      classified_type: classification.type,
      classified_into: createdId,
      ai_meta: {
        model: CLASSIFY_MODEL,
        classification,
        classify_ms: classifyMs,
        total_ms: Date.now() - startedAt,
      },
    })
    .eq("id", inbox.id);
  // The target row exists; a failed bookkeeping update is non-fatal but logged.
  if (updateError) {
    console.error("capture: inbox update failed", updateError.message);
  }

  return NextResponse.json(
    {
      type: classification.type,
      id: createdId,
      title: classification.title,
      area: areaRow ? { id: areaRow.id, name: areaRow.name } : null,
      due_at: classification.due_at ?? null,
    },
    { status: 201 },
  );
}
