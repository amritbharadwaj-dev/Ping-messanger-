/* Ping Messenger — Service Worker  v1.0.0.0.2
   Offline app-shell, runtime caching (SDK, fonts, avatars) and notification clicks. */
const VERSION = '1.0.0.0.1';
const SHELL = 'ping-shell-' + VERSION, RT = 'ping-rt-' + VERSION;
const SHELL_FILES = ['./', 'index.html', 'index.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const CDN = /^(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/;

self.addEventListener('install', e => {
    e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ping-') && k !== SHELL && k !== RT).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting(); });

async function networkFirst(req, fallbackKey) {
    const cache = await caches.open(SHELL);
    const net = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; });
    try {
        return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4500))]);
    } catch (err) {
        const hit = (await cache.match(req, { ignoreSearch: true })) || (fallbackKey && (await cache.match(fallbackKey))) || (fallbackKey && (await cache.match('./')));
        if (hit) { net.catch(() => {}); return hit; }
        return net;
    }
}
async function staleWhileRevalidate(req, onlyImages) {
    const cache = await caches.open(RT), hit = await cache.match(req);
    const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) {
            const ct = r.headers.get('content-type') || '';
            if (!onlyImages || /^image\//.test(ct)) cache.put(req, r.clone()).then(() => trim(cache)).catch(() => {});
        }
        return r;
    }).catch(() => null);
    if (hit) { net.catch(() => {}); return hit; }
    const r = await net;
    return r || new Response('', { status: 504, statusText: 'offline' });
}
async function trim(cache) { const ks = await cache.keys(); if (ks.length > 220) for (const k of ks.slice(0, ks.length - 200)) await cache.delete(k); }

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const u = new URL(req.url);
    if (u.origin === self.location.origin) {
        if (req.mode === 'navigate') { e.respondWith(networkFirst(req, 'index.html')); return; }
        e.respondWith(networkFirst(req)); return;
    }
    if (CDN.test(u.hostname)) { e.respondWith(staleWhileRevalidate(req, false)); return; }
    if (/appwrite\.io$/.test(u.hostname) && /\/storage\/buckets\/[^/]+\/files\/[^/]+\/view/.test(u.pathname)) { e.respondWith(staleWhileRevalidate(req, true)); return; }
});

self.addEventListener('notificationclick', e => {
    const d = e.notification.data || {};
    e.notification.close();
    e.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of list) {
            try { await c.focus(); c.postMessage({ type: 'open', chat: d.chat || '', call: !!d.call }); return; } catch (err) {}
        }
        if (self.clients.openWindow) await self.clients.openWindow('./' + (d.chat ? '?chat=' + encodeURIComponent(d.chat) : ''));
    })());
});
// Web Push (optional, needs a push sender): shows the notification even if the app is closed.
self.addEventListener('push', e => {
    let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Ping', body: e.data ? e.data.text() : '' }; }
    e.waitUntil(self.registration.showNotification(d.title || 'Ping', { body: d.body || 'New message', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'ping', renotify: true, requireInteraction: !!d.call, vibrate: d.call ? [400, 200, 400, 200, 400] : [120, 60, 120], data: { chat: d.chat || '', call: !!d.call } }));
});
