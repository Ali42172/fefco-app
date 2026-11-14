/* FEFCO SOLUTIONS service worker (static build): network-first, offline fallback */
var CACHE = 'fefco-solutions-v4';
var SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './logo.png', './icon-192.png'];
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).catch(function () {})); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) { var u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, cp); }); } return r; }).catch(function () { return caches.match(e.request).then(function (m) { return m || caches.match('./index.html'); }); })); });
