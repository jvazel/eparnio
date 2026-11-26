self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Eparnio', {
        body: data.body || '',
        tag: data.tag || 'eparnio-notification',
        icon: '/icon.svg',
        badge: '/icon.svg',
        data: { url: data.url || '/' }
      })
    );
  } catch {
    const fallbackText = event.data.text ? event.data.text() : '';
    if (fallbackText) {
      event.waitUntil(
        self.registration.showNotification('Eparnio', {
          body: fallbackText,
          icon: '/icon.svg',
          badge: '/icon.svg',
          data: { url: '/' }
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          void client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
