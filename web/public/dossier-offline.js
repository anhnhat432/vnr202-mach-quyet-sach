// Cache only the public dossier HTML and same-origin static assets, never API responses or account data.
const CACHE = "vnr202-public-dossiers-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_PUBLIC_DOSSIER" || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const page = new URL(event.data.page);
      if (page.origin !== self.location.origin || !/^\/ho-so\/[a-z0-9-]+\/?$/.test(page.pathname)) throw new Error("invalid page");
      page.search = ""; page.hash = "";
      const resources = (Array.isArray(event.data.resources) ? event.data.resources : []).map((item) => new URL(item)).filter((item) => item.origin === self.location.origin && item.pathname.startsWith("/_next/static/"));
      const cache = await caches.open(CACHE);
      const targets = [page.href, ...new Set(resources.map((item) => item.href))];
      await Promise.all(targets.map(async (url) => {
        const response = await fetch(url, { credentials: "omit" });
        if (!response.ok) throw new Error("cache fetch failed");
        await cache.put(url, response);
      }));
      event.ports[0].postMessage({ ready: true });
    } catch { event.ports[0].postMessage({ ready: false }); }
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  const dossier = event.request.mode === "navigate" && /^\/ho-so\/[a-z0-9-]+\/?$/.test(url.pathname);
  const asset = url.pathname.startsWith("/_next/static/");
  if (!dossier && !asset) return;
  event.respondWith((async () => {
    try { return await fetch(event.request); }
    catch {
      const cache = await caches.open(CACHE);
      if (dossier) { url.search = ""; url.hash = ""; }
      return (await cache.match(dossier ? url.href : event.request)) ?? Response.error();
    }
  })());
});
