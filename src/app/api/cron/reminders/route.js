import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPushToAll } from '@/lib/dashboard-webpush';
import { translations } from '@/lib/dashboard-translations';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const getKosovoInfo = () => {
      const formatter = new Intl.DateTimeFormat('en-ZA', {
        timeZone: 'Europe/Belgrade',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const getPart = (type) => parts.find(p => p.type === type).value;
      const y = getPart('year');
      const mo = getPart('month');
      const d = getPart('day');
      const h = getPart('hour');
      const m = getPart('minute');
      const s = getPart('second');

      return {
        todayStr: `${y}-${mo}-${d}`,
        nowMs: Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(m), parseInt(s))
      };
    };

    const { todayStr, nowMs } = getKosovoInfo();
    console.log(`[Cron Reminders] Server time: ${new Date().toISOString()}`);
    console.log(`[Cron Reminders] Kosovo time: ${todayStr}, nowMs: ${nowMs}`);

    const { data: settingsRows } = await supabase.from('settings').select('*');

    const cfg = Object.fromEntries(
      (settingsRows || []).map((s) => {
        try {
          return [s.key, JSON.parse(s.value)];
        } catch {
          return [s.key, s.value];
        }
      })
    );
    const lang = cfg.sparta_lang || 'sq';
    const t = (key) => translations[lang]?.[key] || key;

    let count = 0;
    let notified = cfg.sparta_appt_notified || {};
    const newNotified = Object.fromEntries(
      Object.entries(notified).filter(([k]) => k >= todayStr)
    );
    if (!newNotified[todayStr]) {
      newNotified[todayStr] = [];
    }

    const debug = {
      appointmentNotif: !!cfg.appointmentNotif,
      appointmentNotifRaw: cfg.appointmentNotif,
      appointmentMinutesBefore: cfg.appointmentMinutesBefore,
      todayStr,
      nowMs,
    };

    // ── Appointment reminders ──────────────────────────────────────────────
    if (cfg.appointmentNotif) {
      const minutesBefore = Number(cfg.appointmentMinutesBefore) || 30;
      console.log(`[Cron Reminders] Checking appointments (minutesBefore: ${minutesBefore})`);
      // Durable per-appointment dedup lives on appointments.reminder_sent_at
      // (added by migration 002). Fall back to the settings map on older DBs.
      let colAvailable = false;
      try {
        const { error: probeErr } = await supabase
          .from('appointments')
          .select('reminder_sent_at')
          .limit(1);
        colAvailable = !probeErr;
      } catch {
        colAvailable = false;
      }
      const { data: pendingRows } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'pending');
      const allAppts = (pendingRows || []).map((a) => ({
        id: a.id,
        date: a.date,
        time: a.time,
        clientName: a.client_name,
        serviceName: a.service_name,
        workerId: a.worker_id,
        reminderSentAt: a.reminder_sent_at,
      }));
      debug.pendingAppts = allAppts.map(a => ({ id: a.id, date: a.date, time: a.time, clientName: a.clientName }));

      for (const a of allAppts) {
        if (!a.date || !a.time) {
          console.log(`[Cron Reminders] Appointment ${a.id} skipped: missing date/time`);
          continue;
        }

        const [y, mo, d] = a.date.split('-').map(Number);
        const [h, m]     = a.time.split(':').map(Number);
        const apptMs     = Date.UTC(y, mo - 1, d, h, m, 0);

        const fireAt = apptMs - minutesBefore * 60 * 1000;
        const dateKey = a.date;
        const reminderKey = `r:${a.id}`;
        const alreadyFired = colAvailable
          ? !!a.reminderSentAt
          : (newNotified[dateKey] || []).includes(reminderKey);

        const inWindow = nowMs >= fireAt && nowMs <= fireAt + 10 * 60_000;

        debug.lastAppt = {
          id: a.id, date: a.date, time: a.time,
          apptMs, fireAt, inWindow, alreadyFired,
          notifiedToday: newNotified[dateKey] || [],
          diff: nowMs - fireAt,
        };

        console.log(`[Cron Reminders] Appt ${a.id}: ${a.date} ${a.time} | FireAt: ${new Date(fireAt).toISOString()} | Now: ${new Date(nowMs).toISOString()} | AlreadyFired: ${alreadyFired} | InWindow: ${inWindow}`);

        if (!alreadyFired && inWindow) {
          console.log(`[Cron Reminders] Sending push for appointment ${a.id} to worker ${a.workerId}`);
          // owners are automatically included by sendPushToAll
          const pushResult = await sendPushToAll(
            t('kujtues_takimi'),
            `${a.clientName} — ${a.serviceName} (${t('ora')} ${a.time})`,
            reminderKey,
            { appointmentId: a.id },
            a.workerId || []
          );
          debug.lastPushResult = pushResult;

          // Only mark this reminder as "fired" once a push actually got
          // delivered. If sendPushToAll failed or delivered to nobody
          // (missing subscription, transient webpush error, VAPID
          // misconfig, etc.), leave it unmarked so the next cron tick
          // inside the same 10-minute window retries — otherwise a single
          // failed attempt permanently swallows the reminder with no retry
          // and no visible error to the user.
          const delivered = (pushResult?.sent ?? 0) > 0;
          if (delivered) {
            if (colAvailable) {
              await supabase
                .from('appointments')
                .update({ reminder_sent_at: todayStr, reminder_minutes: minutesBefore })
                .eq('id', a.id);
            } else {
              if (!newNotified[dateKey]) {
                newNotified[dateKey] = [];
              }
              newNotified[dateKey].push(reminderKey);
            }
            count++;
          } else {
            console.error(`[Cron Reminders] Push NOT delivered for appointment ${a.id}, will retry next tick:`, pushResult);
          }
        }
      }
    }

    // ── Low stock notifications ──────────────────────────────────────────────
    const lastLowStockCron = cfg.sparta_last_lowstock_cron_at || 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const shouldCheckLowStock = cfg.lowStockNotif && (nowMs - lastLowStockCron >= oneDayMs);
    const lowThreshold = Number(cfg.lowStockThreshold) || 5;

    if (shouldCheckLowStock) {
      console.log(`[Cron Reminders] Checking low stock...`);
      const { data: allProductsRaw } = await supabase.from('produktet').select('*');
      const allProducts = (allProductsRaw || []).map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity,
        minQuantity: p.min_quantity,
      }));
      for (const p of allProducts) {
        const threshold = p.minQuantity ?? lowThreshold;
        if (p.quantity <= threshold) {
          const stockKey = `s:${p.id}`;
          console.log(`[Cron Reminders] Low stock: ${p.name} (${p.quantity} <= ${p.minQuantity})`);

          // Target only owners
          await sendPushToAll(
            t('stoku_i_ulët_notif'),
            t('stoku_i_ulët_body').replace('{}', p.name).replace('{}', String(p.quantity)),
            stockKey,
            { productId: p.id, type: 'low-stock' },
            []
          );

          if (!newNotified[todayStr]) {
            newNotified[todayStr] = [];
          }
          newNotified[todayStr].push(stockKey);
          count++;
        }
      }

      // Update last low stock cron time
      await supabase
        .from('settings')
        .upsert({ key: 'sparta_last_lowstock_cron_at', value: JSON.stringify(nowMs) }, { onConflict: 'key' });
    } else {
      console.log(`[Cron Reminders] Skipping low stock check. lastCron: ${new Date(lastLowStockCron).toISOString()}, now: ${new Date(nowMs).toISOString()}`);
    }

    // ── Recurring expenses (once per day) ──────────────────────────────────
    try {
      const lastRecurringCron = cfg.sparta_last_recurring_cron_at || 0;
      if (nowMs - lastRecurringCron >= oneDayMs) {
        const { applyRecurringExpenses } = await import('@/lib/actions');
        const result = await applyRecurringExpenses();
        debug.recurring = result;
        await supabase
          .from('settings')
          .upsert({ key: 'sparta_last_recurring_cron_at', value: JSON.stringify(nowMs) }, { onConflict: 'key' });
      }
    } catch (recurErr) {
      debug.recurringError = String(recurErr?.message || recurErr);
    }

    if (count > 0 || Object.keys(newNotified).length !== Object.keys(notified).length) {
      try {
        await supabase
          .from('settings')
          .upsert({ key: 'sparta_appt_notified', value: JSON.stringify(newNotified) }, { onConflict: 'key' });
      } catch (persistErr) {
        console.error('cron reminders: failed to persist notified map', persistErr);
      }
    }

    return NextResponse.json({ success: true, sent: count, debug });
  } catch (err) {
    console.error('Cron reminders error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
