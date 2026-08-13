import { NextRequest, NextResponse, after } from "next/server";
import { createBooking, getSalonData } from "@/lib/dashboard-db";
import { sendBookingPush } from "@/lib/push";

export const dynamic = "force-dynamic";

const MSG = {
  sq: {
    missing: "Ju lutem plotësoni të gjitha fushat e detyrueshme.",
    phone: "Ju lutem shkruani një numër telefoni valid.",
    past: "Kjo datë ka kaluar. Ju lutem zgjidhni një datë tjetër.",
    closed: "Jemi mbyllur në këtë ditë. Ju lutem zgjidhni një ditë tjetër.",
    taken: "Ky orar sapo u zu. Ju lutem zgjidhni një orar tjetër.",
    service: "Shërbimi i zgjedhur nuk është më i disponueshëm.",
    server: "Ndodhi një gabim. Na shkruani në Instagram dhe e rregullojmë menjëherë.",
  },
  en: {
    missing: "Please fill in all required fields.",
    phone: "Please enter a valid phone number.",
    past: "That date has passed. Please choose another one.",
    closed: "We're closed on that day. Please choose another one.",
    taken: "That time was just taken. Please pick another one.",
    service: "The selected service is no longer available.",
    server: "Something went wrong. Message us on Instagram and we'll sort it out.",
  },
};

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  let lang: "sq" | "en" = "sq";
  try {
    const body = await request.json();
    lang = body.lang === "en" ? "en" : "sq";
    const m = MSG[lang];

    const clientName = String(body.clientName ?? "").trim();
    const phone = String(body.phone ?? body.clientPhone ?? "").trim();
    const serviceId = String(body.serviceId ?? "").trim();
    const date = String(body.date ?? "").trim();
    const time = String(body.time ?? "").trim();
    const workerId = body.workerId && body.workerId !== "any" ? String(body.workerId) : null;
    const notes = String(body.notes ?? "").trim() || null;
    const extras = Array.isArray(body.extras)
      ? body.extras
          .filter((e: unknown) => e && typeof e === "object")
          .map((e: Record<string, unknown>) => ({ id: String(e.id ?? ""), name: String(e.name ?? ""), price: Number(e.price ?? 0) }))
          .filter((e: { id: string }) => e.id)
      : [];

    if (!clientName || !serviceId || !date || !time) {
      return NextResponse.json({ error: m.missing }, { status: 400 });
    }
    if (phoneDigits(phone).length < 8) {
      return NextResponse.json({ error: m.phone }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const chosen = new Date(`${date}T00:00:00`);
    if (Number.isNaN(chosen.getTime()) || chosen < today) {
      return NextResponse.json({ error: m.past }, { status: 400 });
    }

    const result = await createBooking({
      clientName,
      phone,
      serviceId,
      date,
      time,
      workerId,
      notes,
      extras,
    });

    if (!result.ok) {
      const map: Record<string, { msg: string; code: number }> = {
        closed: { msg: m.closed, code: 400 },
        taken: { msg: m.taken, code: 409 },
        bad_service: { msg: m.service, code: 400 },
        no_db: { msg: m.server, code: 503 },
        failed: { msg: m.server, code: 500 },
      };
      const e = map[result.error ?? "failed"] ?? { msg: m.server, code: 500 };
      return NextResponse.json({ error: e.msg }, { status: e.code });
    }

    // Send push notification directly — instant, no cross-server dependency.
    // Wrapped in after() so the request can respond to the client right away
    // while still guaranteeing (on Vercel/serverless) that the push actually
    // finishes sending before the function is frozen/torn down — a bare
    // fire-and-forget promise here can get killed mid-flight once the
    // response is returned, which is why "new appointment" pushes could be
    // missed intermittently.
    const svcName = result.service?.name || serviceId;
    after(async () => {
      await sendBookingPush(clientName, svcName, date, time).catch((err) =>
        console.error('[appointments] sendBookingPush failed:', err)
      );

      // Also fire dashboard webhook as fallback
      const dashboardUrl = process.env.DASHBOARD_URL;
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (dashboardUrl && webhookSecret) {
        try {
          await fetch(`${dashboardUrl}/api/webhook/new-appointment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${webhookSecret}`,
            },
            body: JSON.stringify({
              clientName,
              serviceName: svcName,
              workerId: null,
              date,
              time,
            }),
          });
        } catch (err) {
          console.error('[appointments] Dashboard webhook fallback failed:', err);
        }
      }
    });

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        clientId: result.clientId ?? null,
        worker: result.workerName ?? null,
        service: result.service?.name,
        price: result.service?.price,
        duration: result.service?.duration,
        date,
        time,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[appointments] create failed:", error);
    return NextResponse.json({ error: MSG[lang].server }, { status: 500 });
  }
}
