import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, pages, render } from '../scripts/layout.mjs';

test('every page uses the current shared top bar, header, footer and action bar (run `npm run layout`)', () => {
  const stale = pages().filter((p) => { const html = readFileSync(join(ROOT, p), 'utf8'); return render(p, html) !== html; });
  assert.deepEqual(stale, []);
});

test('the current page is marked in the main menu', () => {
  for (const p of pages()) {
    const nav = readFileSync(join(ROOT, p), 'utf8').match(/<nav class="nav"[\s\S]*?<\/nav>/)[0];
    const current = [...nav.matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    const inMenu = new RegExp(`<a href="${p.replace('.', '\\.')}"( aria-current="page")?>`).test(nav); // plain menu links, not the Support Us button
    const workspace = ['account.html', 'student-login.html', 'lecturer-login.html', 'admin-login.html'].includes(p);
    assert.deepEqual(current, workspace ? ['learning.html'] : inMenu ? [p] : [], p);
  }
});
