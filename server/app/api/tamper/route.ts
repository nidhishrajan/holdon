import { handleAlert } from "@/lib/alert";
import { CORS } from "@/lib/cors";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const parent = (q.get("parent") || "Margaret").slice(0, 60);
  const child = (q.get("child") || "Sarah").slice(0, 60);
  const r = await handleAlert({ event_type: "tamper", parent_name: parent, child_name: child });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>HoldOn</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui;max-width:480px;margin:15vh auto;padding:0 24px;text-align:center">
<h1>HoldOn removed</h1>
<p>${esc(child)} has been notified${r.telegram_sent ? "" : " (Telegram not configured)"}.</p>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", ...CORS } });
}
