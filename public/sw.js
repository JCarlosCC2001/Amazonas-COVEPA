// Service Worker oficial para PWA instalable y Notificaciones de COVEPA
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Limpiar caches antiguos para prevenir errores de conversión de Response
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    ])
  )
})

// Listener de fetch para cumplir con el estándar de instalación PWA de Chromium/Android/Brave
self.addEventListener('fetch', () => {
  // Passthrough nativo 100% transparente y estable
})

// Manejo de clic en notificaciones en celulares (Android), Windows y PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // Si el usuario presionó la acción de descartar o cerrar, no abre la aplicación
  if (event.action === 'dismiss') {
    return
  }

  const targetUrl = event.notification.data?.url || '/observaciones'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app ya está abierta en alguna pestaña o ventana, enfocarla y navegar
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }
      // Si no hay ninguna ventana abierta, abrir una nueva con la URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
