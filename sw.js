// The Cut. — Service Worker
// Offline-first for the app shell; network-first for all API/data calls.

const CACHE = 'thecut-v1';
const SHELL = ['/'];

// ── Install: cache the app shell ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for data, cache-fallback for app shell ───────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always bypass SW for these — they need fresh data
  const bypass = [
    'supabase.co',
    'anthropic.com',
    'openfoodfacts.org',
    'api/fetch-recipe',
    'api/summary',
  ];
  if (bypass.some(d => url.href.includes(d))) return;

  // For same-origin navigations (the app shell), network → cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful same-origin responses
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  );
});

// ── Notifications ─────────────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      renotify: false,
      data: { url: '/' },
    });
  }

  if (e.data?.type === 'CANCEL_NOTIFICATION') {
    self.registration.getNotifications({ tag: e.data.tag })
      .then(notes => notes.forEach(n => n.close()));
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const existing = cs.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
