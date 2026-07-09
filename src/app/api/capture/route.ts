import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerFromHeader, resolveToken } from "@/lib/auth/token";
import { CaptureInputSchema } from "@/lib/schemas/capture";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Capture endpoint (TASK-014 / FR-001).
 *
 * Raw text in → inbox note out. No AI classification (removed) — every
 * capture is persisted as a plain note; task/journal/routine entries are
 * created manually via their own pages.
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

  // 1. Persist the capture as a plain inbox note. No classification step —
  // every capture is a note (AI classification removed).
  const { data: inbox, error: inboxError } = await db
    .from("inbox_items")
    .insert({
      user_id: userId,
      raw_text: text,
      source,
      status: "classified",
      classified_type: "note",
    })
    .select("id")
    .single();

  if (inboxError || !inbox) {
    return NextResponse.json(
      { error: "could not persist capture", details: inboxError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { type: "note", id: inbox.id, title: text },
    { status: 201 },
  );
}
