import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONE, SITE_PAGES, read, useBrowser } from './helpers.mjs';

const ctx = useBrowser();
const sw = read('sw.js');

test('the service worker pre-caches the same asset versions the pages use', () => {
  const core = [...sw.match(/const CORE = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const used = new Set(SITE_PAGES.flatMap((f) => [...read(f).matchAll(/(?:href|src)="(assets\/(?:css|js)\/[^"]+\?v=[^"]+)"/g)].map((m) => m[1])));
  for (const ref of core.filter((r) => r.includes('?v='))) assert.ok(used.has(ref), `${ref} is what the pages load`);
  for (const ref of used) assert.ok(core.includes(ref), `${ref} is pre-cached`);
});

test('the manifest is valid and its icons exist', () => {
  const manifest = JSON.parse(read('site.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  for (const icon of manifest.icons) assert.ok(read(icon.src.replace(/^\.\//, '')) !== undefined);
  for (const f of SITE_PAGES) assert.match(read(f), /<link rel="manifest" href="site.webmanifest">/, f);
});

async function controlledPage() {
  const context = await ctx.browser.newContext({ viewport: PHONE });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${ctx.url}/index.html`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  return { context, page };
}

test('visited pages keep working offline; other pages show the offline page', async () => {
  const { context, page } = await controlledPage();
  await page.goto(`${ctx.url}/about.html`, { waitUntil: 'networkidle' });
  await context.setOffline(true);

  await page.goto(`${ctx.url}/about.html`);
  assert.match(await page.title(), /About/);
  assert.ok(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('DM Sans')), 'styles load from cache');

  await page.goto(`${ctx.url}/contact.html?topic=Volunteering`);
  assert.match(await page.title(), /Contact/, 'pre-cached pages ignore the query string');

  await page.goto(`${ctx.url}/founder.html`);
  assert.match(await page.title(), /offline/i);
  assert.ok(await page.locator('a[href="tel:+231777891104"]').count());
  await context.close();
});

test('study guides work offline, but the account workspace is never cached', async () => {
  const { context, page } = await controlledPage();
  await page.goto(`${ctx.url}/learning.html`, { waitUntil: 'networkidle' });
  await page.goto(`${ctx.url}/student-login.html`, { waitUntil: 'load' });
  const cached = await page.evaluate(async () => {
    const urls = [];
    for (const n of await caches.keys()) for (const r of await (await caches.open(n)).keys()) urls.push(r.url);
    return urls;
  });
  assert.ok(cached.some((u) => u.endsWith('/learning.html')), 'study portal page is saved');
  assert.ok(cached.some((u) => u.includes('/assets/learning/courses.js')), 'course text is saved');
  assert.deepEqual(cached.filter((u) => /account|login|account\.bundle/.test(u)), [], 'nothing from the account workspace is saved');

  await context.setOffline(true);
  await page.goto(`${ctx.url}/learning.html#lesson/school-leadership/0`);
  await page.waitForFunction(() => /shared school vision/i.test(document.body.innerText));
  await page.goto(`${ctx.url}/student-login.html`);
  assert.match(await page.title(), /offline/i, 'sign-in shows the offline page instead of a stale copy');
  await context.close();
});
