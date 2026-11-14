// Service worker minimal: hanya agar Chrome mengizinkan "Instal aplikasi".
// TIDAK menyimpan cache, jadi file selalu terbaru dari server.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { /* langsung ke jaringan */ });
