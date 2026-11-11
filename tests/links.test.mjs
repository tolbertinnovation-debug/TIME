import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_PAGES, PORTAL_PAGES, read } from './helpers.mjs';
import { ROOT } from './serve.mjs';

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const attrs = (html, name) => [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, 'g'))].map((m) => m[1].replace(/&amp;/g, '&'));

test('internal links point to existing pages and anchors', () => {
  const broken = [];
  for (const file of ALL_PAGES) {
    const html = read(file);
    for (const href of attrs(html, 'href')) {
      if (/^(https?:|mailto:|tel:|sms:|data:|javascript:)/.test(href) || href === '') continue;
      const [pathAndQuery, hash] = href.split('#');
      const path = pathAndQuery.split('?')[0];
      const target = path || file;
      if (!existsSync(join(ROOT, target))) { broken.push(`${file} → ${href} (missing file)`); continue; }
      // The portal uses #routes handled by its script, not element ids.
      if (hash && !PORTAL_PAGES.includes(target) && !ids(read(target)).has(hash)) broken.push(`${file} → ${href} (missing #${hash})`);
    }
  }
  assert.deepEqual(broken, []);
});

test('local images, scripts and stylesheets exist', () => {
  const missing = [];
  for (const file of ALL_PAGES) {
    const html = read(file);
    const refs = [...attrs(html, 'src'), ...attrs(html, 'data-lightbox'),
      ...attrs(html, 'srcset').flatMap((s) => s.split(',').map((c) => c.trim().split(/\s+/)[0])),
      ...attrs(html, 'data-lightbox-webp').flatMap((s) => s.split(',').map((c) => c.trim().split(/\s+/)[0])),
      ...[...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map((m) => m[1])];
    for (const ref of refs) {
      if (!ref || /^(https?:|data:)/.test(ref)) continue;
      if (!existsSync(join(ROOT, ref.split('?')[0]))) missing.push(`${file} → ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('links that open a new tab use rel="noopener"', () => {
  const unsafe = [];
  for (const file of ALL_PAGES) {
    for (const tag of read(file).match(/<a\s[^>]*target="_blank"[^>]*>/g) || []) {
      if (!/rel="[^"]*noopener/.test(tag)) unsafe.push(`${file}: ${tag.slice(0, 120)}`);
    }
  }
  assert.deepEqual(unsafe, []);
});

test('every page has a unique id for each id attribute', () => {
  const dupes = [];
  for (const file of ALL_PAGES) {
    const seen = new Set();
    for (const m of read(file).matchAll(/\sid="([^"]+)"/g)) {
      if (seen.has(m[1])) dupes.push(`${file}: #${m[1]}`);
      seen.add(m[1]);
    }
  }
  assert.deepEqual(dupes, []);
});

test('public pages declare a Content Security Policy that only allows the site itself and FormSubmit', () => {
  for (const file of ALL_PAGES.filter((f) => !PORTAL_PAGES.includes(f))) {
    const csp = read(file).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, `${file} has a CSP`);
    assert.match(csp, /script-src 'self';/, `${file} allows no inline or third-party scripts`);
    assert.match(csp, /connect-src 'self' https:\/\/formsubmit\.co;/);
    assert.match(csp, /object-src 'none'/);
    assert.match(read(file), /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  }
});
