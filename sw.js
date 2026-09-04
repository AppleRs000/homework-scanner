const CACHE_NAME = 'homework-app-v1';
const ASSETS = [
  './',
  './index.html',
  'https://unpkg.com/html5-qrcode'
];

// インストール時に必要なファイルをキャッシュ
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// オフライン時はキャッシュからページを返却
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
