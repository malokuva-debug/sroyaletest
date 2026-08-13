// Sparta Royale Service Worker

const CACHE = 'sparta-royale-v2';

const PRECACHE = ['/dashboard', '/manifest.json'];

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB
// Stores "new appointment" records that need an immediate notification.
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'sparta-sw-db';
const DB_VER = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('pending_new')) {
        db.createObjectStore('pending_new', {
          keyPath: 'id',
        });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);

    req.onerror = (e) => reject(e.target.error);
  });
}

async function dbStorePendingNew(appt) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_new', 'readwrite');

    tx.objectStore('pending_new').put(appt);

    tx.oncomplete = resolve;

    tx.onerror = (e) => reject(e.target.error);
  });
}

async function dbFlushPendingNew() {
  // Returns all queued records and clears them

  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_new', 'readwrite');

    const store = tx.objectStore('pending_new');

    const getReq = store.getAll();

    getReq.onsuccess = (e) => {
      const items = e.target.result || [];

      store.clear();

      resolve(items);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll notifications endpoint
// ─────────────────────────────────────────────────────────────────────────────

async function fetchNotifications() {
  try {
    const res = await fetch('/api/notifications', {
      credentials: 'include',
    });

    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fire notifications
// ─────────────────────────────────────────────────────────────────────────────

async function fireAllDue() {
  // 1. Flush queued "new appointment" notifications

  try {
    const newAppts = await dbFlushPendingNew();

    for (const a of newAppts) {
      const dateLabel = a.date
        ? a.date.split('-').reverse().join('/')
        : '';

      await self.registration
        .showNotification('📅 Takim i ri', {
          body: `${a.clientName || 'Klient'} — ${
            a.serviceName || 'Shërbim'
          }\n${dateLabel} në ${a.time || ''}`,

          icon: '/icon-192.png',

          badge: '/icon-192.png',

          tag: `new-appt-${a.id}`,

          data: {
            appointmentId: a.id,
          },
        })
        .catch(() => {});
    }
  } catch (_) {}

  // 2. Fetch reminder notifications

  const data = await fetchNotifications();

  if (!data?.notifications?.length) {
    return;
  }

  for (const n of data.notifications) {
    if (n.type === 'reminder') {
      await self.registration
        .showNotification('⏰ Kujtues takimi', {
          body: `${n.clientName || 'Klient'} — ${
            n.serviceName || 'Shërbim'
          } (ora ${n.time})`,

          icon: '/icon-192.png',

          badge: '/icon-192.png',

          tag: `reminder-${n.id}`,

          renotify: false,

          data: {
            appointmentId: n.id,
          },
        })
        .catch(() => {});
    }

  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Poll loop
// ─────────────────────────────────────────────────────────────────────────────

let loopResolve = null;

function startLoop() {
  // Prevent duplicate loops

  if (loopResolve) {
    return;
  }

  const promise = new Promise((resolve) => {
    loopResolve = resolve;
  });

  async function run() {
    let idle = 0;

    // 10 × 30s = 5 minutes

    while (idle < 10) {
      await fireAllDue();

      idle++;

      await sleep(30_000);
    }

    loopResolve = null;

    resolve();
  }

  run().catch(() => {
    loopResolve = null;
  });

  return promise;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Install
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {})
  );

  self.skipWaiting();
});

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE)
            .map((k) => caches.delete(k))
        )
      ),

      fireAllDue(),
    ])
  );

  self.clients.claim();
});

// ─────────────────────────────────────────────────────────────────────────────
// Push event — handles server‑sent push notifications (Web Push API)
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = { title: 'Sparta Royale', body: '', tag: '', data: {} };

  try {
    const json = event.data?.json();
    if (json) payload = json;
  } catch {
    try { payload.body = event.data?.text() || ''; } catch {}
  }

  const title = payload.title || 'Sparta Royale';
  const tag = payload.tag || 'push-default';
  const body = (payload.body || '').replace(/\n/g, ' · ');
  const data = (payload.data && typeof payload.data === 'object') ? payload.data : {};

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      data,
    }).then(() => {
      // Tell all open pages to refresh data
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clients => clients.forEach(c => c.postMessage({ type: 'REFRESH_DATA' })));
    }).catch(err => {
      console.error('[SW] showNotification failed:', err);
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Notification click — opens (or focuses) the app
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const apptId = event.notification.data?.appointmentId;
  const url = apptId ? `/dashboard?appointmentId=${apptId}` : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'REFRESH_DATA' });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    }).catch(() => clients.openWindow(url))
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

let lastFetchPoll = 0;

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Restart loop every 30s max

  const now = Date.now();

  if (now - lastFetchPoll > 30_000) {
    lastFetchPoll = now;

    const p = startLoop();

    if (p) {
      event.waitUntil(p);
    }
  }

  if (req.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();

        if (
          res.ok &&
          req.url.startsWith(self.location.origin)
        ) {
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }

        return res;
      })
      .catch(() =>
        caches.match(req).then((c) => c || caches.match('/dashboard'))
      )
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const msg = event.data;

  if (!msg?.type) {
    return;
  }

  const p = handleMessage(msg);

  event.waitUntil(p);

  // Restart loop

  const loop = startLoop();

  if (loop) {
    event.waitUntil(loop);
  }
});

async function handleMessage(msg) {
  switch (msg.type) {
    // Page heartbeat

    case 'HEARTBEAT': {
      await fireAllDue();

      break;
    }

    // Queue new appointment

    case 'NOTIFY_NEW': {
      if (msg.appointment) {
        await dbStorePendingNew(
          msg.appointment
        ).catch(() => {});

        await fireAllDue();
      }

      break;
    }

    // Legacy events

    case 'SCHEDULE_REMINDER':
    case 'CANCEL_APPOINTMENT':
      break;

    default:
      break;
  }
}