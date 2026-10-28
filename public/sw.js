// Service Worker oficial para PWA instalable y notificaciones de COVEPA
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Passthrough a red para mantener la aplicación 100% en vivo con Supabase y Vercel
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
    })
  )
})

