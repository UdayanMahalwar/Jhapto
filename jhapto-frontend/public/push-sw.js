// Service worker for Jhapto browser notifications (messages arrive via Firebase Cloud Messaging).
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const n = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(n.title || 'Jhapto', {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.link || undefined,
    data: { link: data.link || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const tab = tabs.find((c) => c.url.startsWith(self.location.origin));
    if (tab) {
      await tab.focus();
      return tab.navigate(url);
    }
    return self.clients.openWindow(url);
  })());
});
