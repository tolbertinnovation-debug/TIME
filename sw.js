// Service worker: lets visitors on slow or patchy connections reopen pages they have
// already visited, and shows a helpful offline page otherwise.
// The learning portal (accounts, courses, uploads) is never cached: it always uses the network.
const VERSION = "2026-10-24-2";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const IMAGES = "images-v1";
const MAX_IMAGES = 80;

const CORE = [
  "./", "index.html", "programs.html", "contact.html", "faq.html", "offline.html",
  "assets/css/style.css?v=20261024-print", "assets/css/pages.css?v=20261024-print", "assets/js/main.js?v=20261024-print",
  "assets/fonts/dm-sans-latin.woff2", "assets/fonts/manrope-latin.woff2", "assets/img/time-logo-128.png",
];

const PORTAL = /\/(learning|account|student-login|lecturer-login|admin-login)\.html$|\/assets\/learning\//;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ASSETS, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimImages() {
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map((k) => cache.delete(k)));
}

// Pages: always try the network first so visitors see the latest version; fall back to the copy
// saved on an earlier visit, then to the offline page.
async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(PAGES)).put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || caches.match("offline.html");
  }
}

// Versioned CSS/JS and fonts never change at the same URL: serve from cache when present.
async function asset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSETS)).put(request, response.clone());
  return response;
}

// Photos: show the saved copy straight away and refresh it in the background.
async function image(request) {
  const cache = await caches.open(IMAGES);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).then(trimImages);
    return response;
  }).catch(() => cached || Response.error());
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (PORTAL.test(url.pathname)) {
    // Portal pages need the network; only step in to show the offline page when it is unreachable.
    if (request.mode === "navigate") event.respondWith(fetch(request).catch(() => caches.match("offline.html")));
    return;
  }
  if (request.mode === "navigate") return event.respondWith(page(request));
  if (/\.(css|js|woff2)$/.test(url.pathname)) return event.respondWith(asset(request));
  if (/\.(jpg|jpeg|png|webp|svg)$/.test(url.pathname)) return event.respondWith(image(request));
});
