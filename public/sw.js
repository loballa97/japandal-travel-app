
const CACHE_NAME = 'japandal-cache-v1';
const urlsToCache = [
  // '/', // Page d'accueil gérée par la stratégie de navigation
  '/japandal-logo.png',
  '/japandal-logo-192.png',
  '/japandal-logo-512.png',
  // Les assets _next/static sont généralement mis en cache par des stratégies plus avancées ou par le navigateur
  // La page offline est mise en cache explicitement ci-dessous
];

const OFFLINE_HTML_CONTENT = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JAPANDAL - Hors Ligne</title>
  <style>
    body { 
      font-family: 'PT Sans', sans-serif; 
      margin: 0; 
      padding: 20px; 
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      justify-content: center; 
      min-height: 100vh; 
      background-color: #f0f4f8; /* Corresponds to a light theme background */
      color: #1f2937; /* Corresponds to a dark foreground text */
      text-align: center; 
    }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { 
      font-family: 'Poppins', sans-serif; 
      color: #2563eb; /* Primary color */
      margin-bottom: 10px; 
    }
    p { margin-bottom: 20px; }
    a { 
      display: inline-block; 
      padding: 10px 20px; 
      background-color: #2563eb; /* Primary color */
      color: white; 
      text-decoration: none; 
      border-radius: 5px; 
    }
    /* Dark mode styles (optional, if you want the offline page to respect theme) */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #0f172a; /* Dark background */
        color: #e2e8f0; /* Light foreground text */
      }
      h1 {
        color: #60a5fa; /* Brighter primary for dark mode */
      }
      a {
        background-color: #60a5fa;
        color: #0f172a;
      }
    }
  </style>
</head>
<body>
  <div class="icon">⚠️</div>
  <h1>Vous êtes hors ligne</h1>
  <p>JAPANDAL a besoin d'une connexion internet pour fonctionner pleinement. Veuillez vérifier votre connexion et réessayer.</p>
  <a href="/">Réessayer</a>
</body>
</html>
`;

self.addEventListener('install', event => {
log('[ServiceWorker] Install');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
log('[ServiceWorker] Caching app shell & offline page');
      // Cache the offline page content directly
      await cache.put('/offline.html', new Response(OFFLINE_HTML_CONTENT, { headers: { 'Content-Type': 'text/html' } }));
      try {
        // Cache other static assets
        await cache.addAll(urlsToCache);
      } catch (error) {
        console.error('[ServiceWorker] Failed to cache some static assets:', error);
        // Non-critical, some assets might fail if not present, but core offline page is cached.
      }
    })()
  );
});

self.addEventListener('activate', event => {
log('[ServiceWorker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Ensure new SW takes control immediately
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try the network first
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // If the network fails, serve the offline page from cache
log('[ServiceWorker] Network fetch failed for navigation, serving offline page.', error);
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match('/offline.html');
          return cachedResponse;
        }
      })()
    );
  } else if (urlsToCache.includes(new URL(event.request.url).pathname) || 
             event.request.destination === 'image' ||
             event.request.destination === 'style' ||
             event.request.destination === 'script' ||
             event.request.destination === 'font') {
    // For other assets (images, styles, scripts, fonts, and explicitly listed URLs), use cache-first strategy
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(fetchError => {
log('[ServiceWorker] Fetch failed for asset:', event.request.url, fetchError);
            // For assets, if fetch fails and not in cache, it just fails (browser default behavior)
        });
      })
    );
  }
});