// ZEUS Academy — Service Worker
// v2: الصفحة الرئيسية (index.html) الآن "network-first" — يروح دايمًا يتأكد من
// آخر نسخة على السيرفر أول شي، ويستخدم النسخة المحفوظة محليًا بس لو ما كان
// فيه إنترنت. هذا يمنع مشكلة "التطبيق المثبت يضل يعرض نسخة قديمة" بعد كل
// تحديث. الأيقونات وملف manifest.json تبقى cache-first لأنها نادرًا ما تتغيّر.
// أي شي ثاني (Firebase Auth/Firestore، تضمين الفيديوهات) يروح للشبكة مباشرة
// دايمًا ومالوش علاقة بهذا الملف.

const CACHE_NAME = 'zeus-academy-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return; // Firebase وكل شي خارجي يمر عادي بدون تدخل
  }

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('/');

  if (isPage) {
    // Network-first: جرّب الشبكة أول شي عشان توصل آخر نسخة فعليًا،
    // وارجع للنسخة المحفوظة محليًا فقط لو ما كان فيه إنترنت.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // باقي الملفات الثابتة (أيقونات، manifest): cache-first مع تحديث بالخلفية.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
