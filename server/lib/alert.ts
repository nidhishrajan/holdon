import { writeAlert, type AlertInput } from "./ai";
import { addAlert, newId, type EventType } from "./store";
import { sendAlert } from "./telegram";

export const EVENT_TYPES: EventType[] = ["fake_virus_popup", "remote_access_site", "tamper", "setup_test"];

function fallbackText(i: AlertInput): string {
  const p = i.parent_name;
  switch (i.event_type) {
    case "fake_virus_popup":
      return `🚨 ${p} just saw a fake virus popup (${i.page_title || i.url || "unknown page"}). Classic tech-support scam. Call her now.`;
    case "remote_access_site":
      return `🚨 ${p} opened a remote-access site (${i.url || "unknown"}). Scammers use these to take over computers. Call her now.`;
    default:
      return `🚨 HoldOn detected suspicious activity on ${p}'s laptop. Call her now.`;
  }
}

export async function handleAlert(input: AlertInput) {
  const id = newId();
  let risk = "high";
  let summary: string;
  let ai_used = false;
  let sendId: string | null = id;

  if (input.event_type === "setup_test") {
    risk = "low";
    summary = `✅ HoldOn is now protecting ${input.parent_name}.`;
    sendId = null; // no feedback buttons on a test ping
  } else if (input.event_type === "tamper") {
    summary = `⚠️ HoldOn was removed from ${input.parent_name}'s laptop. Scammers often ask victims to do this. Call her now.`;
  } else {
    try {
      const r = await writeAlert(input);
      risk = r.risk;
      summary = r.summary;
      ai_used = true;
    } catch (e) {
      console.warn("[holdon] AI failed, using fallback:", (e as Error).message);
      summary = fallbackText(input);
    }
  }

  const telegram_sent = await sendAlert(summary, sendId);
  addAlert({
    id,
    ts: new Date().toISOString(),
    event_type: input.event_type,
    url: input.url,
    page_title: input.page_title,
    parent_name: input.parent_name,
    child_name: input.child_name,
    risk,
    summary,
    ai_used,
    telegram_sent,
    result: "pending",
  });
  return { id, risk, summary, telegram_sent };
}
