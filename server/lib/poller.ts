import { resolveAlert } from "./store";
import { answerCallback, editMessage, getCallbacks, telegramConfigured } from "./telegram";

const g = globalThis as unknown as { __holdonPoller?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startPoller() {
  if (g.__holdonPoller) return;
  g.__holdonPoller = true;
  void loop();
}

async function loop() {
  let offset = 0;
  console.log("[holdon] Telegram poller started");
  for (;;) {
    if (!telegramConfigured()) {
      await sleep(5000);
      continue;
    }
    try {
      const updates = await getCallbacks(offset);
      for (const { updateId, cb } of updates) {
        offset = updateId + 1;
        if (!cb?.data) continue;
        const [kind, id] = cb.data.split(":");
        if (kind !== "scam" && kind !== "false") continue;
        const result = kind === "scam" ? "scam_stopped" : "false_alarm";
        const label = kind === "scam" ? "✅ Logged: scam stopped" : "❌ Logged: false alarm";
        resolveAlert(id, result);
        await answerCallback(cb.id, label).catch((e) => console.error("[holdon]", e.message));
        if (cb.message) {
          await editMessage(cb.message.chat.id, cb.message.message_id, `${cb.message.text ?? ""}\n\n${label}`).catch(
            (e) => console.error("[holdon]", e.message),
          );
        }
      }
    } catch (e) {
      console.error("[holdon] poll error:", (e as Error).message);
      await sleep(3000);
    }
  }
}
