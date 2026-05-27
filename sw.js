// sw.js
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match('/offline.html'); // ваш dino.html
    })
  );
});