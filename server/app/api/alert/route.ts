import { NextResponse } from "next/server";
import { handleAlert, EVENT_TYPES } from "@/lib/alert";
import { CORS } from "@/lib/cors";
import type { EventType } from "@/lib/store";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS });
  }
  if (!EVENT_TYPES.includes(b.event_type as EventType)) {
    return NextResponse.json(
      { error: `event_type must be one of ${EVENT_TYPES.join(", ")}` },
      { status: 400, headers: CORS },
    );
  }
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const r = await handleAlert({
    event_type: b.event_type as EventType,
    url: str(b.url),
    page_title: str(b.page_title),
    recent_tabs: Array.isArray(b.recent_tabs) ? b.recent_tabs.filter((t) => typeof t === "string") : [],
    parent_name: str(b.parent_name) || "Mom",
    child_name: str(b.child_name) || "there",
  });
  return NextResponse.json(
    { risk: r.risk, summary: r.summary, telegram_sent: r.telegram_sent },
    { headers: CORS },
  );
}
