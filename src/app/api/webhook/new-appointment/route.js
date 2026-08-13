import { NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/dashboard-webpush';
import { getSetting } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const secret = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { clientName, serviceName, workerId, date, time } = body;

    if (!clientName || !date || !time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const lang = await getSetting('sparta_lang', 'sq');
    const title = lang === 'en' ? '📅 New Appointment (Online)' : '📅 Takim i ri (Online)';
    const bodyText = `${clientName} — ${serviceName || 'Service'}\n${date} ${lang === 'en' ? 'at' : 'në'} ${time}`;

    await sendPushToAll(
      title,
      bodyText,
      `new-appt-webhook-${Date.now()}`,
      { type: 'new', clientName, serviceName, date, time },
      workerId ? [workerId] : []
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Webhook new-appointment error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
