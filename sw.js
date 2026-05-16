const CACHE = 'chat-v2';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg'];

// Install — cache app shell
self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

// Activate — delete old caches
self.addEventListener('activate', e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
);

// Fetch — network-first for Firebase, cache-first for app shell
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firestore') || url.includes('googleapis') || url.includes('gstatic')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        // Cache new assets on the fly
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
    );
  }
});

// Notification click — open or focus the app, then tell it which chat to open
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const chat = e.notification.data?.chat;
  const url  = self.registration.scope + (chat ? '?chat=' + chat : '');

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // If app is already open, focus it and send a message to open the chat
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope)) {
          client.focus();
          if (chat) client.postMessage({ type: 'openChat', chat });
          return;
        }
      }
      // Otherwise open a new window
      clients.openWindow(url);
    })
  );
});

// Push event (for future server-side push if needed)
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const { title, body, chat } = e.data.json();
    e.waitUntil(
      self.registration.showNotification(title || 'Новое сообщение', {
        body: body || '',
        icon: './icon.svg',
        badge: './icon.svg',
        tag: 'msg-' + (chat || 'unknown'),
        renotify: true,
        vibrate: [100, 50, 100],
        data: { chat }
      })
    );
  } catch(err) {}
});
