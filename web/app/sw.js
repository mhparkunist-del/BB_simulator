/* bbsim app · service worker: shell network-first (cache fallback), banks cached as fetched, one cache per release */
const VERSION = "bbsim-app-v2.3.0-a400493";
const SHELL = ["index.html", "css/app.css", "js/kv.js", "js/app.js", "js/render/math.js", "js/render/park.js", "js/render/person.js", "js/render/pitcher.js",
  "js/render/figures.js", "js/render/play.js", "js/render/seam.js", "js/game/game.js", "js/club/club.js", "data/roster.json", "data/club.json", "data/kbo.json", "manifest.webmanifest"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(f => new URL(f, self.registration.scope).toString()))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/data/bank/")) {                      // banks: cache first (they never change within a release), else network and keep
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res })));
    return;
  }
  // shell and data: network first so a new deploy shows on the next open; cache keeps it working offline
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res }).catch(() => caches.match(e.request)));
});
