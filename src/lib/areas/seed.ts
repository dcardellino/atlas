import { createClient } from "@/lib/supabase/server";

/**
 * Default life areas seeded on first login (TASK-011, PRD § Open Questions:
 * "Default-Areas vorbefüllen? — ja"). Gives the classifier real targets from
 * the very first capture. Colors are `cat-*` design tokens (docs/design.md).
 */
export const DEFAULT_AREAS = [
  { name: "Familie", slug: "familie", color: "cat-maroon", icon: "home" },
  { name: "Fitness", slug: "fitness", color: "cat-forest", icon: "activity" },
  { name: "Haus", slug: "haus", color: "cat-gold", icon: "wrench" },
  {
    name: "Side-Projects",
    slug: "side-projects",
    color: "cat-navy",
    icon: "rocket",
  },
] as const;

// Per-instance memo of users already confirmed to have areas. Keeps
// seedDefaultAreas off the per-request critical path (TASK-055): after the first
// navigation on a warm instance we skip the existence query entirely. It only
// caches the "areas present" fact, so nothing stale is served.
const ensured = new Set<string>();

/**
 * Idempotently ensure the signed-in user has their default areas. No-op if any
 * areas already exist, so it is safe to call on every authenticated request.
 * Uses the RLS-bound session client; `user_id` comes from the session.
 */
export async function seedDefaultAreas(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (ensured.has(user.id)) return;

  const { count, error } = await supabase
    .from("areas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) return;
  if ((count ?? 0) > 0) {
    ensured.add(user.id);
    return;
  }

  await supabase.from("areas").insert(
    DEFAULT_AREAS.map((area, index) => ({
      user_id: user.id,
      name: area.name,
      slug: area.slug,
      color: area.color,
      icon: area.icon,
      sort_order: index,
    })),
  );
  ensured.add(user.id);
}
