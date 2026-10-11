const API = "https://api.telegram.org";

function creds() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return token && chatId ? { token, chatId } : null;
}

async function call(token: string, method: string, body: unknown, timeoutMs = 10000) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`Telegram ${method} failed: ${res.status} ${data?.description ?? ""}`);
  }
  return data.result;
}

/** Send alert; buttons use callback_data (phone can't reach localhost). Returns false if not sent. */
export async function sendAlert(text: string, alertId: string | null): Promise<boolean> {
  const c = creds();
  if (!c) {
    console.warn("[holdon] Telegram env not set; skipping send");
    return false;
  }
  try {
    await call(c.token, "sendMessage", {
      chat_id: c.chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(alertId
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ It was a scam — I stopped it", callback_data: `scam:${alertId}` }],
                [{ text: "❌ False alarm", callback_data: `false:${alertId}` }],
              ],
            },
          }
        : {}),
    });
    return true;
  } catch (e) {
    console.error("[holdon]", (e as Error).message);
    return false;
  }
}

export interface CallbackQuery {
  id: string;
  data?: string;
  message?: { message_id: number; text?: string; chat: { id: number | string } };
}

export async function getCallbacks(offset: number): Promise<{ updateId: number; cb?: CallbackQuery }[]> {
  const c = creds();
  if (!c) return [];
  const updates = await call(
    c.token,
    "getUpdates",
    { offset, timeout: 25, allowed_updates: ["callback_query"] },
    35000,
  );
  return (updates as { update_id: number; callback_query?: CallbackQuery }[]).map((u) => ({
    updateId: u.update_id,
    cb: u.callback_query,
  }));
}

export async function answerCallback(id: string, text: string) {
  const c = creds();
  if (!c) return;
  await call(c.token, "answerCallbackQuery", { callback_query_id: id, text });
}

export async function editMessage(chatId: number | string, messageId: number, text: string) {
  const c = creds();
  if (!c) return;
  await call(c.token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: { inline_keyboard: [] },
  });
}

export const telegramConfigured = () => creds() !== null;
