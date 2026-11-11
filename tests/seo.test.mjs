import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PAGES, read } from './helpers.mjs';

const SITE = 'https://tolbertinnovation-debug.github.io/TIME/';
const urlFor = (file) => (file === 'index.html' ? SITE : SITE + file);
const meta = (html, re) => html.match(re)?.[1];
const noindex = (html) => /<meta name="robots" content="[^"]*noindex/.test(html);
const indexable = ALL_PAGES.filter((f) => !noindex(read(f)));
const sitemap = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test('the sitemap lists exactly the indexable pages', () => {
  assert.deepEqual([...sitemap].sort(), indexable.map(urlFor).sort());
});

test('robots.txt allows crawling and points to the sitemap', () => {
  const robots = read('robots.txt');
  assert.match(robots, /Allow: \//);
  assert.ok(robots.includes(`Sitemap: ${SITE}sitemap.xml`));
});

for (const file of indexable) {
  test(`${file} has a canonical URL and social sharing tags`, () => {
    const html = read(file);
    assert.equal(meta(html, /<link rel="canonical" href="([^"]+)"/), urlFor(file));
    assert.equal(meta(html, /<meta property="og:url" content="([^"]+)"/), urlFor(file));
    assert.ok(meta(html, /<meta property="og:title" content="([^"]+)"/));
    assert.ok(meta(html, /<meta property="og:description" content="([^"]+)"/));
    assert.match(meta(html, /<meta property="og:image" content="([^"]+)"/) || '', /^https:\/\/.+\.(jpg|png)$/);
  });
}

test('titles and descriptions are unique across pages', () => {
  const titles = new Map(); const descriptions = new Map();
  for (const file of indexable) {
    const html = read(file);
    const t = meta(html, /<title>([^<]+)<\/title>/); const d = meta(html, /<meta name="description" content="([^"]+)"/);
    assert.ok(!titles.has(t), `${file} repeats the title of ${titles.get(t)}`);
    assert.ok(!descriptions.has(d), `${file} repeats the description of ${descriptions.get(d)}`);
    titles.set(t, file); descriptions.set(d, file);
  }
});

test('structured data is valid JSON with the expected types', () => {
  const types = {};
  for (const file of ALL_PAGES) {
    for (const m of read(file).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(m[1]);
      assert.equal(data['@context'], 'https://schema.org', file);
      (types[file] ||= []).push([].concat(data['@type']).join('+'));
    }
  }
  assert.ok(types['index.html'].includes('EducationalOrganization+LocalBusiness'));
  assert.ok(types['faq.html'].includes('FAQPage'));
  assert.ok(types['programs.html'].includes('ItemList'));
  for (const file of indexable.filter((f) => f !== 'index.html' && f !== 'learning.html')) {
    assert.ok(types[file]?.includes('BreadcrumbList'), `${file} has breadcrumbs`);
  }
});

test('the FAQ structured data matches the questions on the page', () => {
  const html = read('faq.html');
  const onPage = [...html.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].length;
  const data = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((d) => d['@type'] === 'FAQPage');
  assert.equal(data.mainEntity.length, onPage);
});

test('the course list data matches the courses on the Programs page', () => {
  const html = read('programs.html');
  const onPage = [...html.matchAll(/<ul class="course-list">([\s\S]*?)<\/ul>/g)].reduce((n, m) => n + (m[1].match(/<li/g) || []).length, 0);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json" id="course-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.itemListElement.length, onPage);
});
