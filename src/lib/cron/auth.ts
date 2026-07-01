import "server-only";

/**
 * Cron request authorisation (TASK-042/043/044). The reminder, daily-summary and
 * calendar-sync routes are public HTTP endpoints, so every call must present the
 * shared CRON_SECRET. Vercel Cron injects it automatically as a Bearer token
 * when CRON_SECRET is configured; the GitHub Actions scheduler (used on the
 * Hobby plan for real frequency) sends the same Bearer. A `?secret=` query param
 * is also accepted for easy manual/curl triggering.
 *
 * Fails closed: with no CRON_SECRET set, nothing is authorised.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}
