const CACHE_NAME = 'jeu-du-30-v1';
// Liste des fichiers à mettre en cache pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Étape 1 : Installation du Service Worker et mise en cache des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Force le Service Worker à devenir actif immédiatement
  self.skipWaiting();
});

// Étape 2 : Nettoyage des anciens caches si une mise à jour a lieu
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Étape 3 : Interception des requêtes pour servir les fichiers depuis le cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retourne le fichier du cache s'il existe, sinon fait une requête réseau
      return cachedResponse || fetch(event.request);
    })
  );
});
