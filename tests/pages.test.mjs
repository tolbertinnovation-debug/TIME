import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP, PHONE, PORTAL_PAGES, SITE_PAGES, openPage, settle, useBrowser } from './helpers.mjs';

const ctx = useBrowser();

for (const file of SITE_PAGES) {
  for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
    test(`${file} renders cleanly on ${label}`, async () => {
      const page = await openPage(ctx, file, viewport);
      await settle(page);

      const report = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        h1: document.querySelectorAll('h1').length,
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        brokenImages: [...document.images].filter((i) => i.getAttribute('src') && (!i.complete || i.naturalWidth === 0)).map((i) => i.currentSrc || i.src),
        imagesWithoutAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src),
        imagesWithoutSize: [...document.images].filter((i) => !i.closest('.lightbox') && (!i.getAttribute('width') || !i.getAttribute('height'))).map((i) => i.src),
      }));

      assert.deepEqual(page.problems, [], 'no script errors or failed requests');
      assert.ok(report.title.length > 10, 'has a title');
      assert.ok(report.description.length > 50, 'has a meta description');
      assert.equal(report.h1, 1, 'exactly one h1');
      assert.equal(report.lang, 'en');
      assert.ok(report.overflow <= 0, `no horizontal scrolling (overflow ${report.overflow}px)`);
      assert.deepEqual(report.brokenImages, [], 'all images load');
      assert.deepEqual(report.imagesWithoutAlt, [], 'all images have alt text (empty for decorative)');
      assert.deepEqual(report.imagesWithoutSize, [], 'all images reserve their size');
      await page.close();
    });
  }
}

for (const file of PORTAL_PAGES) {
  test(`${file} loads without script errors`, async () => {
    const page = await openPage(ctx, file, PHONE);
    await page.waitForTimeout(300);
    // Portal pages call the live account service, which tests block; only script errors matter here.
    assert.deepEqual(page.problems.filter((p) => p.startsWith('script error')), []);
    assert.ok((await page.title()).includes('TIME'));
    await page.close();
  });
}

test('unknown URLs show the custom 404 page', async () => {
  const page = await openPage(ctx, 'no-such-page.html');
  assert.match(await page.title(), /not found/i);
  assert.ok(await page.locator('a[href="index.html"]').count());
  await page.close();
});
