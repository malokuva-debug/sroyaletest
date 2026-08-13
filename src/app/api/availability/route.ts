import { NextRequest, NextResponse } from "next/server";
import { getAvailability, getSalonData } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/availability?date=YYYY-MM-DD&serviceId=…&workerId=…
 * Returns duration-aware slots computed from opening hours, each worker's
 * schedule and the appointments already in the dashboard.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const date = sp.get("date");
  const serviceId = sp.get("serviceId");
  const workerId = sp.get("workerId");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const { services } = await getSalonData();
  const service = services.find((s) => s.id === serviceId);
  const duration = service?.duration ?? 60;

  const rawExtras = sp.getAll("extraId");
  const extraIds = rawExtras.filter((id) => id && id !== "any");

  const result = await getAvailability(
    date,
    duration,
    workerId && workerId !== "any" ? workerId : null,
    service?.id,
    extraIds
  );

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
