import { NextResponse } from 'next/server';
import { getPushDiagnostics, sendPushToAll } from '@/lib/dashboard-webpush';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diag = await getPushDiagnostics();
  return NextResponse.json(diag, { status: 200 });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;
    const result = await sendPushToAll(
      '🧪 Test from server',
      'If you see this, push notifications are working!',
      'diag-test',
      { type: 'test' },
      userId ? [userId] : []
    );
    return NextResponse.json({ result, diag: await getPushDiagnostics() });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await supabase.from('settings').delete().eq('key', 'sparta_appt_notified');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
