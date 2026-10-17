/*
 * Blueprint service worker. Deliberately small:
 * - shows a friendly offline screen when a page can't load
 * - keeps the app's own code, styles and fonts (/_next/static/...) on the
 *   device after the first visit, so the installed app starts fast. Next.js
 *   gives those files content-hashed names that never change, so a cached copy
 *   is never stale.
 * It never caches pages, API responses or anything with your data.
 */
const VERSION = "bp-shell-v2";
const STATIC = "bp-static-v1";
const STATIC_MAX = 400;
const SHELL = ["/icon.svg", "/pwa-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#09090b"><title>Offline · Blueprint</title>
<style>
  :root { color-scheme: dark light; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #09090b; color: #fafafa;
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; box-sizing: border-box; }
  @media (prefers-color-scheme: light) { body { background: #f7f7f5; color: #0b0b0d; } p { color: #44444c !important; } }
  main { max-width: 340px; text-align: center; }
  h1 { font-size: 22px; letter-spacing: -0.02em; margin: 18px 0 6px; }
  p { color: #a1a1aa; margin: 0 0 22px; }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 12px; padding: 12px 20px; background: #6366f1; color: #fff; min-height: 44px; }
</style></head><body><main>
<img src="/icon.svg" width="64" height="64" alt="">
<h1>You're offline</h1>
<p>Blueprint will reconnect as soon as you're back online. Nothing you saved is lost.</p>
<button onclick="location.reload()">Try again</button>
</main></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  // Immutable build assets: cache first, fill the cache on the way.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          await cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      }),
    );
  }
});

// Old builds' files pile up over many deploys; keep the newest few hundred.
async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length <= STATIC_MAX) return;
  await Promise.all(keys.slice(0, keys.length - STATIC_MAX).map((k) => cache.delete(k)));
}
