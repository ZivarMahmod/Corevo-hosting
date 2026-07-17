/* Kund-ytans service worker (plan 015): tar emot Web Push och öppnar rätt
 * /konto-djuplänk vid klick. Medvetet mager — ingen caching/offline här (Workers
 * serverar redan allt); SW:n finns för push. Registreras av PushOptIn. */

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    /* trasig payload → generisk notis */
  }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'Ny notis'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === 'string' ? payload.body : '',
      icon: '/pwa/personal-icon-192.png',
      badge: '/pwa/personal-icon-192.png',
      data: { url: typeof payload.url === 'string' ? payload.url : '/konto' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/konto'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url.includes('/konto') && 'focus' in win) return win.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
