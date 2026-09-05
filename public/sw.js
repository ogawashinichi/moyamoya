const CACHE = 'moyamoya-v6';
const STATIC = ['/style.css', '/app.js', '/board.js', '/favicon.svg', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API・フィード・サイトマップはネットワーク優先
  if (url.pathname.startsWith('/api/') || url.pathname === '/feed.xml' || url.pathname === '/sitemap.xml') {
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }
  // 静的ファイルはキャッシュ優先、fallbackにネットワーク
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
