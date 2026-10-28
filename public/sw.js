// Service Worker oficial para PWA instalable de COVEPA
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
// Al no invocar event.respondWith(), el navegador delega directamente al stack de red nativo,
// evitando promesas rechazadas, desconexiones por inactividad y pantallas en blanco.
self.addEventListener('fetch', () => {
  // Passthrough nativo 100% transparente y estable
})

