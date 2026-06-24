// Service worker - TIDAK cache file app (biar update selalu kebaca)
// Data offline ditangani lewat localStorage di app.js

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  // Hapus semua cache lama
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  self.clients.claim();
});
// Semua request langsung ke network, tidak dicache
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
