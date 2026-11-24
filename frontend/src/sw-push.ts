/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  try {
    const data = event.data.json() as {
      title?: string;
      body?: string;
      url?: string;
      tag?: string;
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'Eparnio', {
        body: data.body || '',
        tag: data.tag || 'eparnio-notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: { url: data.url || '/' },
      })
    );
  } catch {
    // Ignorer un payload invalide
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data as { url?: string } | undefined)?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) {
            return (client as WindowClient).navigate(targetUrl);
          }
          return client;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
