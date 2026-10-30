/* AquaSense service worker
 * - Network-first cho trang (HTML) để luôn có bản mới nhất, fallback offline khi mất mạng.
 * - Cache-first cho tài nguyên tĩnh (_next/static, icons).
 * - KHÔNG can thiệp /api/* và WebSocket để dữ liệu cảm biến luôn realtime.
 */
const VERSION = 'aquasense-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket') || url.pathname.startsWith('/ws')) return

  // Trang HTML: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(async () => (await caches.match(request)) || caches.match('/offline.html')),
    )
    return
  }

  // Tài nguyên tĩnh: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/model/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
})
