import { NextResponse } from "next/server";
import { CORS } from "@/lib/cors";
import { resetStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Demo helper: wipe the in-memory log so stats start at zero.
export function POST() {
  resetStore();
  return NextResponse.json({ ok: true }, { headers: CORS });
}
