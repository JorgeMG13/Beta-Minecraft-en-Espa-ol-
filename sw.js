const CACHE_NAME = 'minecraft-es-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Recibe el push del servidor (o desde el cliente vía postMessage)
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || '🟢 Minecraft en Español', {
      body: data.body || 'Nueva publicación disponible',
      icon: '/favicon-96x96.png',
      badge: '/favicon-96x96.png',
      tag: data.tag || 'nueva-publicacion',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// Al hacer clic en la notificación, abre/enfoca la web
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Notificaciones locales enviadas desde la página (sin servidor push)
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: '/favicon-96x96.png',
      badge: '/favicon-96x96.png',
      tag: tag || 'nueva-publicacion',
      renotify: true,
      data: { url: '/' }
    });
  }
});
