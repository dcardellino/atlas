import "server-only";

/**
 * ntfy push notifications (TASK-041, FR-009). Posts to NTFY_TOPIC_URL — with an
 * own topic no auth key is needed (PRD § Third-Party Services). Dynamic content
 * (task titles, which may carry umlauts) goes in the UTF-8 body, not in HTTP
 * headers; titles stay short and ASCII. No-ops with a warning when the topic URL
 * is unset so a missing env never crashes a cron run.
 */

export type NtfyMessage = {
  title?: string;
  body: string;
  tags?: string[];
  priority?: 1 | 2 | 3 | 4 | 5;
  click?: string;
};

export async function sendNtfy(
  message: NtfyMessage,
  topicUrl: string | undefined = process.env.NTFY_TOPIC_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!topicUrl) {
    console.warn("[ntfy] NTFY_TOPIC_URL not set — skipping push");
    return false;
  }

  const headers: Record<string, string> = {};
  if (message.title) headers["Title"] = message.title;
  if (message.tags?.length) headers["Tags"] = message.tags.join(",");
  if (message.priority) headers["Priority"] = String(message.priority);
  if (message.click) headers["Click"] = message.click;

  try {
    const res = await fetchImpl(topicUrl, {
      method: "POST",
      headers,
      body: message.body,
    });
    if (!res.ok) {
      console.warn(`[ntfy] push failed with status ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `[ntfy] push error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
