import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../scripts/layout.mjs';
import { DATA, build } from '../scripts/programs.mjs';
import { buildIndex } from '../scripts/search-index.mjs';
import { DESKTOP, PHONE, openPage, read, useBrowser } from './helpers.mjs';

const ctx = useBrowser();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();

test('program pages are up to date with data/programs.json (run `npm run programs`)', () => {
  for (const p of DATA) assert.equal(read(p.file), build(p), p.file);
});

test('program page course lists match the Programs page', () => {
  const programs = read('programs.html');
  for (const p of DATA) {
    let onPage;
    if (p.panel === 'cohort-1') {
      const section = programs.slice(programs.indexOf('id="cohort-1"'), programs.indexOf('</section>', programs.indexOf('id="cohort-1"')));
      onPage = [...section.matchAll(/<article class="card[^"]*">[\s\S]*?<h3>([\s\S]*?)<\/h3>/g)].map((m) => decode(m[1]));
    } else {
      const start = programs.indexOf(`id="${p.panel}"`);
      const list = programs.slice(programs.indexOf('<ul class="course-list">', start), programs.indexOf('</ul>', start));
      onPage = [...list.matchAll(/<li><span class="n">\d+<\/span><span>([^<]*)/g)].map((m) => decode(m[1]));
    }
    assert.deepEqual(p.courses.map((c) => c.name), onPage, p.slug);
    assert.ok(programs.includes(`href="${p.file}"`), `programs.html links to ${p.file}`);
  }
});

test('the search index is up to date (run `npm run search`)', () => {
  assert.equal(readFileSync(join(ROOT, 'assets/search-index.json'), 'utf8'), buildIndex());
});

test('a program page shows facts, courses, steps and related programs', async () => {
  const page = await openPage(ctx, 'programs-diploma.html', PHONE);
  assert.match(await page.locator('h1').textContent(), /Diploma Programs/);
  assert.equal(await page.locator('#courses .course-list li').count(), 10);
  assert.equal(await page.locator('#enrol .step').count(), 4);
  assert.equal(await page.locator('#related .card').count(), 3);
  assert.match(await page.locator('.program-facts a[href^="https://wa.me/"]').getAttribute('href'), /Diploma%20Programs/);
  assert.equal(await page.locator('.crumbs a[href="programs.html"]').count(), 1);
  await page.close();
});

test('the header search icon opens the search page on every screen size', async () => {
  for (const vp of [PHONE, DESKTOP]) {
    const page = await openPage(ctx, 'index.html', vp);
    await page.click('.search-link');
    await page.waitForURL(/search\.html$/);
    await page.locator('#search-q').waitFor();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'search-q', 'the search box is ready to type in');
    await page.close();
  }
});

async function search(q) {
  const page = await openPage(ctx, `search.html?q=${encodeURIComponent(q)}`, PHONE);
  await page.waitForFunction(() => !/Loading/.test(document.getElementById('search-status').textContent));
  return page;
}

test('search finds courses first and links to their program page', async () => {
  const page = await search('quickbooks');
  const first = page.locator('#search-results li').first();
  assert.equal(await first.locator('a').getAttribute('href'), 'programs-diploma.html#courses');
  assert.equal(await first.locator('mark').first().textContent(), 'QuickBooks');
  assert.match(await page.locator('#search-status').textContent(), /results? for/);
  await page.close();
});

test('search finds FAQ answers, ignores accents and case, and opens the answer on the FAQ page', async () => {
  const page = await search('INSTALLMENTS');
  const faqLink = page.locator('#search-results a[href^="faq.html?q="]').first();
  assert.ok(await faqLink.count());
  const accents = await search('phitia academy');
  assert.ok(await accents.locator('#search-results a[href="phica.html"]').count(), 'Phitia matches Phìtìa');
  await accents.close();
  await faqLink.click();
  await page.waitForURL(/faq\.html\?q=/);
  assert.ok(await page.locator('.faq-group details[open]').count() >= 1);
  await page.close();
});

test('search handles empty, unknown and unsafe queries', async () => {
  const empty = await search('');
  assert.match(await empty.locator('#search-status').textContent(), /Type a word/);
  await empty.close();
  const none = await search('zzqqxx');
  assert.match(await none.locator('#search-status').textContent(), /No results/);
  assert.equal(await none.locator('#search-results li').count(), 0);
  await none.close();
  const evil = await search('<img src=x onerror=window.pwned=1>');
  assert.equal(await evil.evaluate(() => window.pwned), undefined);
  assert.equal(await evil.locator('#search-results img').count(), 0);
  await evil.close();
});

test('typing updates results and the address without reloading', async () => {
  const page = await search('');
  await page.fill('#search-q', 'saturday');
  await page.waitForFunction(() => document.querySelectorAll('#search-results li').length > 0);
  await page.waitForFunction(() => location.search.includes('q=saturday'));
  await page.close();
});

test('tuition on each program page matches the fee table on the Programs page', () => {
  const programs = read('programs.html');
  const table = programs.slice(programs.indexOf('<table class="fee-table">'), programs.indexOf('</table>'));
  for (const p of DATA) {
    const row = table.match(new RegExp(`<tr><th scope="row"><a href="${p.file}">[\\s\\S]*?</tr>`))?.[0];
    if (p.online) { assert.equal(row, undefined, `${p.slug} has no published fee`); continue; }
    assert.ok(row, `${p.file} is in the fee table`);
    if (p.tuition) {
      assert.ok(row.includes(`US$${p.tuition}`), `${p.slug} tuition US$${p.tuition} in fee table`);
      assert.ok(read(p.file).includes(`US$${p.tuition}`), `${p.slug} page shows US$${p.tuition}`);
      assert.ok(row.includes(`LRD ${(p.tuition * 170).toLocaleString('en-US')}`), `${p.slug} LRD amount uses US$1 = LRD 170`);
    } else {
      assert.match(row, /Confirmed by the administration/);
    }
  }
});

test('the 2027 intake dates are the same everywhere they appear', () => {
  const dates = { '2027-01-04': /January 4|Jan 4/, '2027-03-08': /March 8|Mar 8/, '2027-10-14': /October 14|Oct 14/ };
  for (const file of ['programs.html', 'faq.html', 'news.html', 'index.html', ...DATA.filter((p) => !p.online).map((p) => p.file)]) {
    const html = read(file);
    for (const [iso, words] of Object.entries(dates)) {
      for (const m of html.matchAll(new RegExp(`<time datetime="${iso}">([^<]*)</time>`, 'g'))) assert.match(m[1], words, `${file}: ${m[1]}`);
    }
    assert.ok(!/datetime="2027-(?!01-04|03-08|10-14)/.test(html), `${file} has no other 2027 dates`);
  }
});
