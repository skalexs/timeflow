// TimeFlow — Service Worker v2
// Enables PWA installability + offline caching

const CACHE_VERSION = 'v2'
const CACHE_NAME = `timeflow-${CACHE_VERSION}`

// Static assets to cache for offline
const PRECACHE = [
  '/',
  '/manifest.json',
  '/offline.html',
]

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching precache assets')
        return cache.addAll(PRECACHE).catch(err => {
          console.warn('[SW] Precaching failed (ok during dev):', err)
        })
      })
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ──────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key)
            return caches.delete(key)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET') return
  if (url.protocol === 'chrome-extension:') return

  // Network-first for API calls (dynamic data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response(
          JSON.stringify({ error: 'Sin conexión', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        ))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/apple') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) return cached
          return fetch(request)
            .then(response => {
              if (response.ok) {
                const clone = response.clone()
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
              }
              return response
            })
            .catch(() => cached) // fallback to stale cache
        })
    )
    return
  }

  // Network-first for navigation / pages
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache successful page loads
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => {
          // Offline: serve cached page or offline.html
          return caches.match('/offline.html')
            .then(offlinePage => {
              if (offlinePage) return offlinePage
              // Last resort: return a minimal offline response
              return new Response(
                '<html><body style="background:#0a0a0f;color:#f0f0f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h2>Sin conexión</h2><p>TimeFlow necesita conexión para cargar.<br>Abre la app cuando tengas red.</p></div></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
            })
        })
    )
    return
  }

  // Default: network only
  event.respondWith(fetch(request))
})
