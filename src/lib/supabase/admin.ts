import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (server-only) — bypasses RLS.
 *
 * Used exclusively for the token-authenticated capture path, where the iOS
 * shortcut holds no Supabase session and `auth.uid()` is therefore empty.
 * Inserts on this client MUST always set `user_id` explicitly (resolved from
 * the API token), so the row still belongs to the right user even though RLS
 * is bypassed. All PWA/session traffic uses the RLS-bound client in server.ts
 * instead (PRD § Security; § Auth > Shortcut-Token).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
