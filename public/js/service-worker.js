// Novo arquivo para cache offline
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('v1').then((cache) => {
            return cache.addAll([
                '/',
                '/css/style.css',
                '/js/main.js',
                '/offline.html'
            ]);
        })
    );
}); 