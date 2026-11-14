// TIME Learning service worker: lets students read their lessons without a connection.
//
// What it keeps on the phone:
//   - the app's own files (scripts, styles, fonts, logo), which never change once built;
//   - class and lesson pages the signed-in student has opened or saved.
// What it never keeps: assessments, fees, certificates, administration, or anything sent to the server.
// When there is a connection the server is always asked first, so every permission and fee check still runs.

const STATIC = "time-static-v1";
const PAGES = "time-pages-v1"; // emptied by the app whenever nobody is signed in (see offline.tsx)
const OFFLINE_PAGE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((cache) => cache.addAll([OFFLINE_PAGE, "/logo.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== STATIC && n !== PAGES).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Only a student's class list, class pages and lessons may be kept. Assessments are never kept.
function saveable(pathname) {
  if (pathname === "/my-classes") return true;
  return /^\/learn\/[^/]+(\/[^/]+)?$/.test(pathname) && !pathname.includes("/assess");
}

const isAppFile = (pathname) =>
  pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image") || pathname.startsWith("/icons/") || pathname === "/logo.png" || pathname === OFFLINE_PAGE;

const isPage = (response) =>
  response.ok && response.type === "basic" && !response.redirected && (response.headers.get("content-type") || "").includes("text/html");

// Keep a page, and the app files it needs to display.
async function savePage(pathname, response) {
  const html = await response.clone().text();
  await (await caches.open(PAGES)).put(pathname, response);
  const files = new Set();
  for (const m of html.matchAll(/\/_next\/(?:static|image)[^"'\\\s<>)]+/g)) files.add(m[0].replace(/&amp;/g, "&"));
  const cache = await caches.open(STATIC);
  await Promise.all([...files].map(async (file) => {
    if (await cache.match(file)) return;
    try {
      const res = await fetch(file);
      if (res.ok) await cache.put(file, res);
    } catch { /* no connection: the page is still kept */ }
  }));
}

async function appFile(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

async function openPage(event) {
  const url = new URL(event.request.url);
  try {
    const res = await fetch(event.request);
    // Pages carrying a one-off message (?ok=...) are not kept, so the message is not shown again later.
    if (saveable(url.pathname) && !url.search && isPage(res)) event.waitUntil(savePage(url.pathname, res.clone()));
    return res;
  } catch {
    const kept = saveable(url.pathname) ? await (await caches.open(PAGES)).match(url.pathname) : undefined;
    return kept || (await caches.match(OFFLINE_PAGE)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isAppFile(url.pathname)) event.respondWith(appFile(request));
  else if (request.mode === "navigate") event.respondWith(openPage(event));
});

// "Save lessons for offline": the class page sends the list of pages to keep.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "save" || !Array.isArray(data.paths)) return;
  const reply = event.ports[0];
  event.waitUntil((async () => {
    let saved = 0;
    let failed = 0;
    for (const path of data.paths.slice(0, 300)) {
      const url = new URL(String(path), self.location.origin);
      if (url.origin !== self.location.origin || !saveable(url.pathname)) continue;
      try {
        const res = await fetch(url.pathname, { credentials: "same-origin" });
        if (!isPage(res)) throw new Error("not a page");
        await savePage(url.pathname, res);
        saved += 1;
      } catch { failed += 1; }
    }
    reply?.postMessage({ saved, failed });
  })());
});
