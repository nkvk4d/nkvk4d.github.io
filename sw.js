// sw.js - полная версия с кешированием
const CACHE_NAME = 'offline-cache-v1';
const OFFLINE_URL = '/offline.html';
const FAVICON_URL = '/favicon.ico';

// Файлы, которые нужно закешировать при установке
const FILES_TO_CACHE = [
  OFFLINE_URL,
  FAVICON_URL
];

// При установке - сохраняем все нужные файлы в кеш
self.addEventListener('install', (event) => {
  console.log('[SW] Установка Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Кеширование файлов');
      // Пытаемся закешировать все файлы
      for (const file of FILES_TO_CACHE) {
        try {
          const response = await fetch(file);
          if (response.ok) {
            await cache.put(file, response);
            console.log(`[SW] Закеширован: ${file}`);
          } else {
            console.warn(`[SW] Не удалось закешировать: ${file} (статус ${response.status})`);
          }
        } catch (error) {
          console.error(`[SW] Ошибка кеширования ${file}:`, error);
        }
      }
      return cache;
    })
  );
  // Активируем сразу, не дожидаясь завершения старых SW
  self.skipWaiting();
});

// При активации - очищаем старые кеши
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Удаляем старый кеш: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Захватываем контроль над всеми страницами
  event.waitUntil(clients.claim());
});

// При запросе - стратегия: сначала сеть, при ошибке - кеш
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Пропускаем запросы не к нашему сайту (например, аналитику)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если запрос успешен и это GET - сохраняем в кеш для будущих офлайн-визитов
        if (response.ok && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // При ошибке сети - пытаемся достать из кеша
        console.log(`[SW] Офлайн режим, ищем в кеше: ${event.request.url}`);
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          console.log(`[SW] Найдено в кеше: ${event.request.url}`);
          return cachedResponse;
        }
        
        // Если запрошен favicon и его нет в кеше - пробуем достать offline.html
        if (event.request.url.includes('favicon.ico')) {
          console.log('[SW] favicon не найден, используем offline.html как fallback');
          return caches.match(OFFLINE_URL);
        }
        
        // Для любых других запросов - показываем offline страницу с игрой
        console.log('[SW] Используем offline.html как fallback');
        return caches.match(OFFLINE_URL);
      })
  );
});
