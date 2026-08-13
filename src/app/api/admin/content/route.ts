import { NextResponse } from "next/server";
import { getDraftContent, saveDraftContent } from "@/lib/site-content-server";
import type { SiteContent } from "@/lib/blocks/types";

export const runtime = "nodejs";

export async function GET() {
  const content = await getDraftContent();
  return NextResponse.json({ content });
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as SiteContent;
    if (!body || !body.hero || !body.nav) {
      return NextResponse.json({ error: "Malformed content payload." }, { status: 400 });
    }
    const result = await saveDraftContent(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save draft." }, { status: 500 });
  }
}
