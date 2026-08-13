import { NextResponse } from "next/server";
import { getSalonData } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

/** Everything the public site renders: services, bookable staff, opening hours. */
export async function GET() {
  const data = await getSalonData();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
