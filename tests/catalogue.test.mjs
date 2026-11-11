import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { DESKTOP, openPage, useBrowser } from './helpers.mjs';
import { catalogue, SCHOOLS } from '../scripts/catalogue.mjs';
import { DATA as PROGRAMS } from '../scripts/programs.mjs';

const ctx = useBrowser();

test('the catalogue and programs page are up to date', () => {
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
