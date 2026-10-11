import type { EventType } from "./store";

export interface AlertInput {
  event_type: EventType;
  url?: string;
  page_title?: string;
  recent_tabs?: string[];
  parent_name: string;
  child_name: string;
}

export interface AiResult {
  risk: "low" | "medium" | "high";
  summary: string;
}

const BASE_URL = "https://api.routerplus.com/v1";

export async function writeAlert(input: AlertInput): Promise<AiResult> {
  const key = process.env.TM_API_KEY;
  if (!key) throw new Error("TM_API_KEY not set");

  const system =
    "You write urgent, plain-language Telegram alerts for an adult child whose elderly parent may be " +
    "the victim of a tech-support scam (fake virus popup -> 'call Microsoft' -> remote access tool like AnyDesk). " +
    "Use the parent's name. Max 2 short sentences and under 30 words total; end with a clear action (e.g. 'Call her now.'). " +
    'Reply with ONLY the JSON object, no other text: {"risk":"low|medium|high","summary":"..."}';
  const user = JSON.stringify({
    event_type: input.event_type,
    url: input.url,
    page_title: input.page_title,
    recent_tabs: (input.recent_tabs ?? []).slice(0, 10),
    parent_name: input.parent_name,
    child_name: input.child_name,
  });

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`RouterPlus ${res.status}`);
  const data = await res.json();
  const content = extractText(data?.choices?.[0]?.message?.content);
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  let parsed: { risk?: string; summary?: unknown };
  try {
    if (!match) throw new Error("AI returned no JSON");
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.warn("[holdon] AI raw response:", (content || JSON.stringify(data)).slice(0, 300));
    throw e;
  }
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  if (!summary) throw new Error("AI returned empty summary");
  const risk = (["low", "medium", "high"].includes(parsed.risk ?? "") ? parsed.risk : "high") as AiResult["risk"];
  return { risk, summary };
}

/** content may be a string or an array of {type:"text", text} parts */
function extractText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c.map((p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : "")).join("");
  }
  return "";
}
