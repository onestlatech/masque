// Classic service worker, compiled on its own by the masque:service-worker Vite plugin: no imports.

// Replaced at build time: every file of the build, and a hash of their contents.
declare const __PRECACHE__: string[];
declare const __VERSION__: string;
const PRECACHE = __PRECACHE__;
const CACHE = `masque-${__VERSION__}`;

// Minimal typings: the WebWorker lib conflicts with the DOM lib used everywhere else.
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}
const sw = self as unknown as {
  addEventListener(
    type: "install" | "activate",
    listener: (e: ExtendableEvent) => void,
  ): void;
  addEventListener(type: "fetch", listener: (e: FetchEvent) => void): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  registration: { scope: string };
  skipWaiting(): Promise<void>;
};

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(PRECACHE);
}

async function purge() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith("masque-") && k !== CACHE)
      .map((k) => caches.delete(k)),
  );
}

async function respond(request: Request, key: Request | string) {
  const cache = await caches.open(CACHE);
  // Servers may send Vary: Origin, and module scripts are requested with an Origin header the precache lacked.
  return (await cache.match(key, { ignoreVary: true })) ?? fetch(request);
}

sw.addEventListener("install", (e) => e.waitUntil(precache()));
sw.addEventListener("activate", (e) => e.waitUntil(purge()));
// Sent by the update banner: otherwise the new version waits until every tab closes.
sw.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") void sw.skipWaiting();
});

sw.addEventListener("fetch", (e) => {
  const { request } = e;
  if (
    request.method !== "GET" ||
    new URL(request.url).origin !== location.origin
  )
    return;
  // Single-page app: every navigation gets the cached shell, with its security headers.
  const key =
    request.mode === "navigate"
      ? new URL("./", sw.registration.scope).href
      : request;
  e.respondWith(respond(request, key));
});
