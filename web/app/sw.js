/* bbsim app · service worker: shell cached on install, banks cached as they are fetched (offline replay afterwards) */
const VERSION = "bbsim-app-v2.0";
const SHELL = ["index.html", "css/app.css", "js/kv.js", "js/app.js", "js/render/math.js", "js/render/park.js", "js/render/person.js", "js/render/pitcher.js",
  "js/render/figures.js", "js/render/play.js", "js/render/seam.js", "js/game/game.js", "js/club/club.js", "data/roster.json", "data/club.json", "manifest.webmanifest"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(f => new URL(f, self.registration.scope).toString()))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/data/bank/")) {                      // banks: network first, then cache; cache what arrives
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return r }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const cp = res.clone(); caches.open(VERSION).then(c => c.put(e.request, cp)); return res })));
});
