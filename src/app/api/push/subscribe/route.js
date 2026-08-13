import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { v4 as uuid } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { subscription, userId } = await req.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('endpoint', subscription.endpoint);

    if (existing && existing.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({
          subscription: JSON.stringify(subscription),
          user_id: userId || existing[0].user_id,
        })
        .eq('endpoint', subscription.endpoint);
    } else {
      await supabase.from('push_subscriptions').insert({
        id: uuid(),
        endpoint: subscription.endpoint,
        subscription: JSON.stringify(subscription),
        created_at: new Date().toISOString(),
        user_id: userId || null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('push subscribe error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { userId } = await req.json().catch(() => ({}));
    if (userId) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    } else {
      await supabase.from('push_subscriptions').delete().neq('id', '');
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('push delete error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
