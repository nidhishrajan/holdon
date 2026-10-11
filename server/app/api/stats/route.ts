import { NextResponse } from "next/server";
import { CORS } from "@/lib/cors";
import { getStats } from "@/lib/store";
import { telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET() {
  return NextResponse.json({ ...getStats(), telegram_configured: telegramConfigured() }, { headers: CORS });
}
