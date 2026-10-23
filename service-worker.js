importScripts('./release.js?v=0.1.0-dev.34');
const CACHE = `daymark-shell-${self.DAYMARK_RELEASE.version}`;
// Match the versioned URLs in index.html so online and offline loads use the same assets.
const ASSETS = ['./', './index.html', './styles.css?v=0.1.0-dev.34', './app.js?v=0.1.0-dev.34', './shensha.js?v=0.1.0-dev.34', './translations.js?v=0.1.0-dev.34', './i18n.js?v=0.1.0-dev.34', './notes.js?v=0.1.0-dev.34', './sync.js?v=0.1.0-dev.34', './sync-config.js?v=0.1.0-dev.34', './install.js?v=0.1.0-dev.34', './release.js?v=0.1.0-dev.34', './updates.js?v=0.1.0-dev.34', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'DAYMARK_ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('daymark-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const allowed = ASSETS.map(asset => new URL(asset, self.registration.scope).href);
  if (!allowed.includes(url.href.split('#')[0])) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match('./index.html') : Response.error())));
});
