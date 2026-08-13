import { supabase, hasSupabaseConfig } from "./supabase";

let wp: any = null;

async function getWebpush() {
  if (!wp) {
    const mod = await import("web-push");
    wp = mod.default || mod;
    const email = process.env.VAPID_EMAIL || "mailto:valmir.mlku@gmail.com";
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
    const privKey = process.env.VAPID_PRIVATE_KEY || "";
    if (!pubKey || !privKey) return null;
    wp.setVapidDetails(
      email.startsWith("mailto:") ? email : `mailto:${email}`,
      pubKey,
      privKey
    );
  }
  return wp;
}

export async function sendBookingPush(
  clientName: string,
  serviceName: string,
  date: string,
  time: string
) {
  try {
    const webpush = await getWebpush();
    if (!webpush) {
      console.error("[Landing Push] VAPID keys not configured");
      return;
    }

    if (!hasSupabaseConfig()) {
      console.error("[Landing Push] No DB connection");
      return;
    }

    const { data: rows, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription");
    if (error) throw error;
    if (!rows || rows.length === 0) {
      console.log("[Landing Push] No subscriptions found");
      return;
    }

    const payload = JSON.stringify({
      title: "📅 Takim i ri (Online)",
      body: `${clientName} — ${serviceName}\n${date} në ${time}`,
      tag: `new-appt-${Date.now()}`,
      data: { type: "new", clientName, serviceName, date, time },
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      rows.map(async (row: { endpoint: unknown; subscription: unknown }) => {
        try {
          const sub = JSON.parse(String(row.subscription));
          await webpush.sendNotification(sub, payload);
          sent++;
        } catch (err: any) {
          failed++;
          const status = err.statusCode || err.status;
          console.error(
            `[Landing Push] Failed for endpoint=${String(row.endpoint).substring(0, 50)}... status=${status} msg=${err.message}`
          );
          if (status === 410 || status === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", String(row.endpoint))
              .then(() => {}, () => {});
          }
        }
      })
    );

    console.log(`[Landing Push] Done: sent=${sent}, failed=${failed}, total=${rows.length}`);
  } catch (err) {
    console.error("[Landing Push] Error:", err);
  }
}
