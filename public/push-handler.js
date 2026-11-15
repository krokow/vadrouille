/* Gestion des notifications push dans le service worker (importé par Workbox) */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'Vadrouille', body: event.data ? event.data.text() : '' } }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vadrouille', {
      body: data.body || '',
      tag: data.tag,
      icon: scope + 'pwa-192.png',
      badge: scope + 'pwa-192.png',
      data: { url: data.url ? scope + data.url.replace(/^\//, '') : scope },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          c.navigate(url).catch(() => {})
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
