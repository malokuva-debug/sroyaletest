// app/api/notifications/route.js
// Called by the Service Worker every 30 s.
// Returns appointments that need a reminder notification fired right now.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // ── Auth: must have a valid session ────────────────────────────────────
    const sessionId = (await cookies()).get('sparta_session')?.value;

    if (!sessionId) {
      return NextResponse.json({ notifications: [] });
    }

    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', sessionId);

    const userId = sessionRows?.[0]?.user_id;
    if (!userId) {
      return NextResponse.json({ notifications: [] });
    }

    const { data: userRows } = await supabase.from('users').select('*').eq('id', userId);
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ notifications: [] });
    }
    const user = userRows[0];

    // ── Settings ───────────────────────────────────────────────────────────
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

    // Already-notified map: { 'YYYY-MM-DD': ['r:appt-id', ...] }
    // Stored in settings under key 'sparta_appt_notified'
    let notified = cfg.sparta_appt_notified || {};

    // Build updated notified map (clean old dates first)
    const newNotified = Object.fromEntries(
      Object.entries(notified).filter(([k]) => k >= todayStr)
    );

    if (!newNotified[todayStr]) {
      newNotified[todayStr] = [];
    }

    const toNotify = [];

    // ── Appointment reminders ────────────────────────────────────────────────
    if (cfg.appointmentNotif) {
      const minutesBefore = Number(cfg.appointmentMinutesBefore) || 30;

      const apptsQuery = supabase.from('appointments').select('*');
      const { data: allApptsRaw } =
        user.role === 'owner'
          ? await apptsQuery
          : await supabase.from('appointments').select('*').eq('worker_id', user.id);

      const allAppts = (allApptsRaw || []).map((a) => ({
        id: a.id,
        date: a.date,
        time: a.time,
        status: a.status,
        clientName: a.client_name,
        serviceName: a.service_name,
      }));

      for (const a of allAppts) {
        if (!a.date || !a.time) continue;

        // Only remind for pending appointments
        if ((a.status || 'pending') !== 'pending') continue;

        const [y, mo, d] = a.date.split('-').map(Number);
        const [h, m]     = a.time.split(':').map(Number);
        const apptMs     = Date.UTC(y, mo - 1, d, h, m, 0);

        // ── Reminder: fire within [fireAt, fireAt + 90s] ───────────────────
        const fireAt = apptMs - minutesBefore * 60 * 1000;

        const dateKey       = a.date;
        const reminderKey   = `r:${a.id}`;
        const alreadyFired  = (newNotified[dateKey] || []).includes(reminderKey);

        if (!alreadyFired && nowMs >= fireAt && nowMs <= fireAt + 90_000) {
          toNotify.push({
            type: 'reminder',
            id:            a.id,
            clientName:    a.clientName,
            serviceName:   a.serviceName,
            date:          a.date,
            time:          a.time,
            minutesBefore,
          });

          if (!newNotified[dateKey]) {
            newNotified[dateKey] = [];
          }
          newNotified[dateKey].push(reminderKey);
        }
      }
    }

    // ── Persist updated notified map back to DB ────────────────────────────
    // Always persist so old-date cleanup is saved, even when nothing fired.
    try {
      await supabase
        .from('settings')
        .upsert({ key: 'sparta_appt_notified', value: JSON.stringify(newNotified) }, { onConflict: 'key' });
    } catch (persistErr) {
      // Non-fatal — notifications were already collected, just log
      console.error('notifications: failed to persist notified map', persistErr);
    }

    return NextResponse.json({ notifications: toNotify });
  } catch (err) {
    console.error('notifications route error:', err);
    return NextResponse.json({ notifications: [] });
  }
}
