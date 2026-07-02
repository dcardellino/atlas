import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shortcut-token auth (TASK-015, FR-006, PRD § Auth > Shortcut-Token).
 *
 * The iOS shortcut authenticates with a long-lived bearer token instead of a
 * Supabase session. Only the hash `sha256(token + CAPTURE_PEPPER)` is stored in
 * `api_tokens`; the plaintext is shown to the user exactly once on creation.
 * `/api/capture` resolves the bearer token back to a `user_id` to perform
 * RLS-correct inserts (via the admin client with explicit user_id).
 */

const TOKEN_PREFIX = "atls_";

/** Generate a new opaque plaintext token (shown once, never stored). */
export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(24).toString("base64url");
}

/** Deterministic hash used both on creation and on lookup. */
export function hashToken(token: string): string {
  const pepper = process.env.CAPTURE_PEPPER ?? "";
  return createHash("sha256").update(token + pepper).digest("hex");
}

/**
 * Outcome of resolving a bearer token. `invalid` = unknown/empty token,
 * `revoked`/`expired` = a known token that is no longer usable — the route maps
 * each to a 401 (with a "Token neu erzeugen" hint for revoked/expired). TASK-056.
 */
export type TokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "revoked" | "expired" };

/**
 * Resolve a raw bearer token to its owning user_id. Rejects tokens that have
 * been revoked (`revoked_at`) or have expired (`expires_at < now`) with a
 * distinct reason. Bumps `last_used_at` on a hit. Uses the admin client because
 * there is no session context on the token path.
 */
export async function resolveToken(token: string): Promise<TokenResult> {
  const trimmed = token?.trim();
  if (!trimmed) return { ok: false, reason: "invalid" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, user_id, revoked_at, expires_at")
    .eq("token_hash", hashToken(trimmed))
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "invalid" };
  if (data.revoked_at) return { ok: false, reason: "revoked" };
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  // Best-effort usage timestamp; failure here must not block the capture.
  await admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { ok: true, userId: data.user_id };
}

/** Extract a bearer token from an Authorization header, or null. */
export function bearerFromHeader(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
