import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerFromHeader, resolveToken } from "@/lib/auth/token";
import { CaptureInputSchema } from "@/lib/schemas/capture";
import {
  classify,
  CLASSIFY_MODEL,
  type AreaContext,
} from "@/lib/ai/classify";
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

// Simple in-memory rate limit: 60 requests / minute / user. Per-instance only —
// adequate for a single-user MVP (PRD § Security suggests 60/min).
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string, now: number): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}

async function authenticate(request: NextRequest): Promise<Auth | null> {
  // 1. Supabase session (PWA quick capture).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { userId: user.id, db: supabase };

  // 2. Bearer token (iOS shortcut) → admin client + explicit user_id.
  const token = bearerFromHeader(request.headers.get("authorization"));
  if (token) {
    const userId = await resolveToken(token);
    if (userId) return { userId, db: createAdminClient() };
  }
  return null;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  const auth = await authenticate(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (rateLimited(auth.userId, startedAt)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
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

  // 4. Create the target entry. Phase 1 handles task/note/journal; routines get
  // their own path in Phase 2 (TASK-035) — until then a routine is filed as a task.
  let createdId = inbox.id;
  const effectiveType =
    classification.type === "routine" ? "task" : classification.type;

  if (effectiveType === "task") {
    const { data: task } = await db
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
  } else if (effectiveType === "journal") {
    const { data: entry } = await db
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
  }
  // 'note' → no separate row; the inbox_item itself is the note.

  // 5. Mark the inbox item classified, with timings (TASK-024).
  await db
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
