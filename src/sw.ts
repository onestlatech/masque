// Classic service worker, compiled on its own by the masque:service-worker Vite plugin: no imports.

// Replaced at build time: every file of the build, and a hash of their contents.
declare const __PRECACHE__: string[]
declare const __VERSION__: string
const PRECACHE = __PRECACHE__
const CACHE = `masque-${__VERSION__}`

// Minimal typings: the WebWorker lib conflicts with the DOM lib used everywhere else.
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}
interface FetchEvent extends ExtendableEvent {
  request: Request
  respondWith(response: Promise<Response>): void
}
const sw = self as unknown as {
  addEventListener(type: 'install' | 'activate', listener: (e: ExtendableEvent) => void): void
  addEventListener(type: 'fetch', listener: (e: FetchEvent) => void): void
  registration: { scope: string }
}

sw.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
})

sw.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('masque-') && k !== CACHE).map((k) => caches.delete(k)))),
  )
})

sw.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return
  // Single-page app: every navigation gets the cached shell, with its security headers.
  const key = request.mode === 'navigate' ? new URL('./', sw.registration.scope).href : request
  // Servers may send Vary: Origin, and module scripts are requested with an Origin header the precache lacked.
  e.respondWith(caches.open(CACHE).then(async (cache) => (await cache.match(key, { ignoreVary: true })) ?? fetch(request)))
})
