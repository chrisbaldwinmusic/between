// Service worker for the team app (/team installed on a phone). It does two things: shows push
// notifications (src/lib/webpush.js), and shows a simple "you're offline" page when there's no
// signal. It doesn't cache team data on the device: everything else goes straight to the network
// (and through Cloudflare Access) as normal. Lives at the site root, outside /team*, so Access
// doesn't block the browser fetching it; registered with scope /team.

const OFFLINE = '/between-ops-offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('between-ops-v1').then(c => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener('push', (event) => {
  let msg = {};
  try { msg = event.data ? event.data.json() : {}; } catch { msg = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(msg.title || 'Between Ops', {
    body: msg.body || '',
    icon: '/img/app/icon-192.png',
    badge: '/img/app/badge-96.png',
    tag: msg.tag,
    data: { url: msg.url || '/team' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/team', self.location.origin).href;
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = open.find(c => c.url.startsWith(`${self.location.origin}/team`));
    if (existing) {
      await existing.focus();
      return existing.navigate ? existing.navigate(url) : undefined;
    }
    return self.clients.openWindow(url);
  })());
});
