import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PHONE, DESKTOP, openPage, read, useBrowser } from './helpers.mjs';
import { catalogue, SCHOOLS } from '../scripts/catalogue.mjs';
import { DATA as PROGRAMS } from '../scripts/programs.mjs';

const ctx = useBrowser();

test('the catalogue, programs page and application form are up to date', () => {
  execFileSync('node', ['scripts/catalogue.mjs', '--check'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

test('every program course belongs to exactly one school, and only Special Education has a confirmed mode', () => {
  const cat = catalogue();
  const total = PROGRAMS.reduce((n, p) => n + p.courses.length, 0);
  assert.equal(cat.courses.length, total);
  const ids = new Set(SCHOOLS.map((s) => s.id));
  for (const c of cat.courses) {
    assert.ok(ids.has(c.school_id), `${c.id} has a school`);
    assert.ok(['on-campus', 'blended', 'online'].includes(c.delivery_mode));
    assert.equal(c.delivery_confirmed, c.program_id === 'special-education', c.id);
  }
  assert.equal(new Set(cat.courses.map((c) => c.id)).size, cat.courses.length, 'course ids are unique');
  for (const s of SCHOOLS) assert.ok(cat.courses.some((c) => c.school_id === s.id), `${s.id} has courses`);
});

test('the programs page lists courses by school with planned delivery badges', async () => {
  const page = await openPage(ctx, 'programs.html', DESKTOP);
  assert.equal(await page.locator('#schools .school-card').count(), 4);
  assert.equal(await page.locator('#schools .school-courses li').count(), catalogue().courses.length);
  await page.locator('#school-business-media summary').click();
  assert.ok(await page.locator('#school-business-media li', { hasText: 'QuickBooks' }).locator('.mode-online.proposed').isVisible());
  assert.deepEqual(page.problems, []);
  await page.close();
});

async function applyPage(reply, query = '') {
  const page = await openPage(ctx, `admissions.html${query}`, PHONE);
  page.posts = [];
  await page.route('https://formsubmit.co/**', async (route) => {
    page.posts.push(route.request().postDataJSON());
    if (reply === 'network') return route.abort();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  return page;
}

test('the online application checks required fields, then sends the application', async () => {
  const page = await applyPage({ success: 'true' });
  await page.click('#apply-form button[type=submit]');
  assert.equal(await page.locator('#apply-form .field-error').count(), 3);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'a-name');
  await page.fill('#a-name', 'Ama Test');
  await page.fill('#a-phone', '0888 123 456');
  await page.selectOption('#a-course', { label: 'QuickBooks' });
  await page.selectOption('#a-track', { label: 'Saturdays' });
  await page.click('#apply-form button[type=submit]');
  await page.locator('#apply-form .form-status.ok').waitFor();
  assert.equal(page.posts.length, 1);
  assert.equal(page.posts[0].course, 'QuickBooks');
  assert.equal(page.posts[0].schedule, 'Saturdays');
  assert.match(page.posts[0]._subject, /^\[Application\] QuickBooks – Ama Test$/);
  assert.match(await page.locator('#apply-form .form-status').textContent(), /Thank you, Ama/);
  assert.equal(await page.inputValue('#a-name'), '');
  await page.close();
});

test('a failed application offers email and WhatsApp, and ?course= preselects the course', async () => {
  const page = await applyPage('network', '?course=monitoring');
  assert.equal(await page.inputValue('#a-course'), 'Monitoring & Evaluation (M&E)');
  await page.fill('#a-name', 'Ama Test');
  await page.fill('#a-phone', '0888123456');
  await page.click('#apply-form button[type=submit]');
  const wa = page.locator('#apply-form .form-status a[href^="https://wa.me/"]');
  await wa.waitFor();
  assert.match(decodeURIComponent(await wa.getAttribute('href')), /Course: Monitoring & Evaluation/);
  assert.match(await page.locator('#apply-form .form-status a[href^="mailto:"]').getAttribute('href'), /^mailto:tinstitute312@gmail.com\?subject=/);
  await page.close();
});

test('the online learning and certificate check pages render and link from the footer', async () => {
  for (const file of ['online-learning.html', 'verify.html']) {
    const page = await openPage(ctx, file, PHONE);
    assert.equal(await page.locator('h1').count(), 1);
    assert.deepEqual(page.problems, []);
    await page.close();
  }
  const footer = read('partials/footer.html');
  assert.ok(footer.includes('href="online-learning.html"') && footer.includes('href="verify.html"'));
  assert.ok(read('partials/topbar.html').includes('href="account.html"'));
});

test('the certificate check builds a WhatsApp message from the details', async () => {
  const page = await openPage(ctx, 'verify.html', DESKTOP);
  await page.evaluate(() => { window.open = (u) => { window.__opened = u; }; });
  await page.click('#verify-form button[value=whatsapp]');
  assert.equal(await page.locator('#verify-form .field-error').count(), 2);
  await page.fill('#v-name', 'Ama Test');
  await page.fill('#v-code', 'TIME-2026-014');
  await page.fill('#v-org', 'Bong County School Board');
  await page.click('#verify-form button[value=whatsapp]');
  const opened = decodeURIComponent(await page.evaluate(() => window.__opened));
  assert.match(opened, /^https:\/\/wa\.me\/231888901848\?text=Certificate check request/);
  assert.match(opened, /Certificate number: TIME-2026-014/);
  await page.close();
});
