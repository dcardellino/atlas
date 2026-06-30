"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateToken, hashToken } from "@/lib/auth/token";

/**
 * Shortcut-token management server actions (TASK-016, FR-006).
 * All run under the session client (RLS); the user_id comes from the session.
 */

export type TokenSummary = {
  id: string;
  label: string | null;
  last_used_at: string | null;
  created_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return { supabase, userId: user.id };
}

export async function listTokens(): Promise<TokenSummary[]> {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from("api_tokens")
    .select("id, label, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Create a token. The plaintext is returned exactly once — only the hash is
 * stored. The caller must show it to the user immediately and never again.
 */
export async function createToken(
  label: string,
): Promise<{ id: string; plaintext: string }> {
  const { supabase, userId } = await requireUser();
  const plaintext = generateToken();

  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id: userId,
      token_hash: hashToken(plaintext),
      label: label.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "could not create token");
  }

  revalidatePath("/settings");
  return { id: data.id, plaintext };
}

export async function revokeToken(id: string): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("api_tokens").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/settings");
}
