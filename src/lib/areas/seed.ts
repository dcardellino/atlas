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

  const { count, error } = await supabase
    .from("areas")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error || (count ?? 0) > 0) return;

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
}
