import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP, openPage, settle, useBrowser } from './helpers.mjs';

const ctx = useBrowser();

test('printing the Programs page shows every course and hides navigation', async () => {
  const page = await openPage(ctx, 'programs.html', DESKTOP);
  await settle(page);
  await page.emulateMedia({ media: 'print' });
  const visible = (sel) => page.locator(sel).first().isVisible();
  assert.ok(!(await visible('.site-header')));
  assert.ok(!(await visible('.action-bar')));
  const panels = await page.locator('.program-panel').count();
  const shown = await page.locator('.program-panel:visible').count();
  assert.equal(shown, panels, 'all course categories print, not just the selected tab');
  await page.close();
});

test('printing the FAQ shows every answer', async () => {
  const page = await openPage(ctx, 'faq.html', DESKTOP);
  await settle(page);
  await page.emulateMedia({ media: 'print' });
  const answers = page.locator('.faq .answer');
  const n = await answers.count();
  for (let i = 0; i < n; i++) assert.ok(await answers.nth(i).isVisible(), `answer ${i + 1} prints`);
  await page.close();
});
