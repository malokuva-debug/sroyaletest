import { NextResponse } from "next/server";
import { rollbackToPrevious } from "@/lib/site-content-server";

export const runtime = "nodejs";

export async function POST() {
  const result = await rollbackToPrevious();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
