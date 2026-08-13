import { supabase } from './supabase';

let webpush = null;

async function getWebpush() {
  if (!webpush) {
    const mod = await import('web-push');
    webpush = mod.default || mod;
    const email = process.env.VAPID_EMAIL || 'mailto:example@example.com';
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privKey = process.env.VAPID_PRIVATE_KEY || '';
    console.log('[Push] Initializing web-push', { hasPubKey: !!pubKey, hasPrivKey: !!privKey, pubKeyLen: pubKey.length, privKeyLen: privKey.length });
    webpush.setVapidDetails(
      email.startsWith('mailto:') ? email : `mailto:${email}`,
      pubKey,
      privKey
    );
  }
  return webpush;
}

export async function sendPushToAll(title, body, tag, data = {}, targetUserId = null) {
  const logPrefix = `[Push:${tag || 'no-tag'}]`;
  try {
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privKey = process.env.VAPID_PRIVATE_KEY || '';

    if (!pubKey || !privKey) {
      console.error(`${logPrefix} SKIPPED — VAPID keys not set. pubKey=${pubKey ? 'set' : 'MISSING'}, privKey=${privKey ? 'set' : 'MISSING'}`);
      return { sent: 0, error: 'VAPID keys missing' };
    }

    const { data: owners, error: ownersErr } = await supabase
      .from('users')
      .select('id, username')
      .eq('role', 'owner');
    if (ownersErr) throw ownersErr;
    const ownerIds = (owners || []).map(o => o.id);
    console.log(`${logPrefix} Owners found: ${owners?.length ?? 0} [${(owners || []).map(o => o.username).join(', ')}] ownerIds=[${ownerIds.join(', ')}]`);

    const targetIds = targetUserId
      ? (Array.isArray(targetUserId) ? targetUserId : [targetUserId])
      : [];

    const combinedIds = Array.from(new Set([...targetIds, ...ownerIds]));
    console.log(`${logPrefix} targetUserId=${JSON.stringify(targetUserId)}, targetIds=[${targetIds.join(', ')}], combinedIds=[${combinedIds.join(', ')}]`);

    if (combinedIds.length === 0) {
      console.error(`${logPrefix} SKIPPED — no owner or target user IDs to send to`);
      return { sent: 0, error: 'No target user IDs' };
    }

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', combinedIds);
    if (subsErr) throw subsErr;
    console.log(`${logPrefix} Subscriptions found: ${subs?.length ?? 0} for userIds=[${combinedIds.join(', ')}]`);
    if (!subs || subs.length === 0) {
      console.error(`${logPrefix} SKIPPED — NO push subscriptions in DB for these userIds. Users may not have enabled browser notifications.`);
      return { sent: 0, error: 'No subscriptions found for target users' };
    }

    for (const s of subs) {
      console.log(`${logPrefix}   sub endpoint=${s.endpoint.substring(0, 60)}... userId=${s.user_id}`);
    }

    const wp = await getWebpush();
    const payload = JSON.stringify({ title, body, tag, data });
    console.log(`${logPrefix} Sending to ${subs.length} subscription(s), payload length=${payload.length}`);

    let sent = 0;
    let failed = 0;
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const sub = JSON.parse(s.subscription);
          await wp.sendNotification(sub, payload);
          sent++;
          console.log(`${logPrefix} ✓ Sent to ${s.endpoint.substring(0, 50)}...`);
        } catch (err) {
          failed++;
          const status = err.statusCode || err.status || 'unknown';
          console.error(`${logPrefix} ✗ Failed for ${s.endpoint.substring(0, 50)}... status=${status} msg=${err.message}`);
          if (status === 410 || status === 404) {
            console.log(`${logPrefix}   Removing expired subscription ${s.id}`);
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          }
          throw err;
        }
      })
    );

    console.log(`${logPrefix} Done: sent=${sent}, failed=${failed}, total=${subs.length}`);
    return { sent, failed };
  } catch (err) {
    console.error(`${logPrefix} FATAL ERROR:`, err.message || err, err.stack);
    return { sent: 0, error: err.message };
  }
}

export async function getPushDiagnostics() {
  try {
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const privKey = process.env.VAPID_PRIVATE_KEY || '';

    const { data: owners } = await supabase.from('users').select('id, username').eq('role', 'owner');
    const { data: allUsers } = await supabase.from('users').select('id, username, role');
    const { data: allSubs } = await supabase.from('push_subscriptions').select('*');

    const ownerList = owners || [];
    const userList = allUsers || [];
    const subList = allSubs || [];

    const ownerSubs = subList.filter(s => ownerList.some(o => o.id === s.user_id));
    const orphanSubs = subList.filter(s => !userList.some(u => u.id === s.user_id));

    return {
      vapidKeysSet: !!(pubKey && privKey),
      pubKeyLength: pubKey.length,
      privKeyLength: privKey.length,
      users: userList,
      owners: ownerList.map(o => o.username),
      totalSubscriptions: subList.length,
      ownerSubscriptions: ownerSubs.length,
      orphanSubscriptions: orphanSubs.length,
      subscriptions: subList.map(s => ({
        userId: s.user_id,
        endpoint: s.endpoint.substring(0, 60) + '...',
        createdAt: s.created_at,
      })),
    };
  } catch (err) {
    return { error: err.message };
  }
}
