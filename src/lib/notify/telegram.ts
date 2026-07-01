import "server-only";

/**
 * Telegram push notifications (FR-009). Sends a message to a chat via the Bot
 * API: POST https://api.telegram.org/bot<token>/sendMessage. Telegram has no
 * separate title field, so the (optional) title and body are composed into one
 * message — the title bold via HTML parse mode. No-ops with a warning when the
 * bot token / chat id are unset, so a missing env never crashes a cron run.
 */

export type NotifyMessage = {
  title?: string;
  body: string;
};

/** Escape the few characters that are special in Telegram's HTML parse mode. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegram(
  message: NotifyMessage,
  opts: { botToken?: string; chatId?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const botToken = opts.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts.chatId ?? process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping push",
    );
    return false;
  }

  const text = message.title
    ? `<b>${escapeHtml(message.title)}</b>\n${escapeHtml(message.body)}`
    : escapeHtml(message.body);

  try {
    const res = await fetchImpl(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      console.warn(`[telegram] push failed with status ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `[telegram] push error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
