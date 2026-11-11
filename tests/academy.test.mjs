import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP, PHONE, openPage, useBrowser } from './helpers.mjs';

const ctx = useBrowser();
const KEY = 'time-learning-v1';

async function academy(hash = '', viewport = PHONE, saved) {
  const page = await openPage(ctx, 'learning.html', viewport);
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, saved || null]);
  await page.goto(`${ctx.url}/learning.html${hash}`);
  await page.reload();
  await page.locator('#academy h1').first().waitFor();
  return page;
}
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

test('the academy home shows courses, subjects, paths and the shared site header', async () => {
  const page = await academy('', DESKTOP);
  assert.equal(await page.locator('.site-header a[href="learning.html"][aria-current="page"]').count(), 1);
  assert.equal(await page.locator('.ac-cat').count(), 6);
  assert.equal(await page.locator('#home-courses .ac-card').count(), 6);
  assert.equal(await page.locator('.ac-path').count(), 3);
  await page.click('[data-home-filter="health-community"]');
  assert.equal(await page.locator('#home-courses .ac-card').count(), 3);
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('the course library searches titles, lecturers and unit names, and filters by subject and path', async () => {
  const page = await academy('#courses');
  assert.match(await page.locator('#search-count').textContent(), /^8 courses$/);
  await page.fill('#course-search', 'safeguarding');
  await page.fill('#course-search', 'student well-being');
  assert.match(await page.locator('#search-count').textContent(), /^1 course$/);
  await page.fill('#course-search', 'Mr. Bee');
  assert.match(await page.locator('#course-results h3').first().textContent(), /Drug Dispensing/);
  await page.fill('#course-search', '');
  await page.click('[data-cat="Health"]');
  assert.match(await page.locator('#search-count').textContent(), /^2 courses$/);
  await page.click('[data-cat=""]');
  await page.selectOption('#course-path', 'school-leader');
  assert.match(await page.locator('#search-count').textContent(), /^4 courses$/);
  await page.fill('#course-search', 'zzzz');
  assert.ok(await page.locator('.ac-empty').isVisible());
  await page.close();
});

test('a unit is completed only after a correct practice answer, and progress is saved', async () => {
  const page = await academy('#lesson/school-leadership/0');
  const mark = page.locator('#mark-reviewed');
  assert.ok(await mark.isDisabled());
  await page.locator('#quiz-form input[value="1"]').check();
  await page.click('#quiz-form button[type=submit]');
  assert.match(await page.locator('#quiz-feedback').textContent(), /Not quite/);
  await page.locator('#quiz-form input[value="0"]').check();
  await page.click('#quiz-form button[type=submit]');
  assert.match(await page.locator('#quiz-feedback').textContent(), /Correct/);
  await mark.click();
  await page.waitForFunction(() => /1 of 6 studied/.test(document.querySelector('.ac-toc-foot')?.textContent || ''));
  const s = await stored(page);
  assert.equal(s.lessons['school-leadership:0'], true);
  assert.equal(s.attempts['school-leadership:0'], 2);
  assert.equal(s.last, 'school-leadership:0');
  await page.fill('#lesson-notes', 'Ask about baseline data');
  assert.equal((await stored(page)).notes['school-leadership:0'], 'Ask about baseline data');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => location.hash === '#lesson/school-leadership/1');
  await page.close();
});

test('backups from the earlier portal still load, and a finished course unlocks its learning record', async () => {
  const lessons = Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`policy-strategy:${i}`, true]));
  const page = await academy('#my', DESKTOP, { version: 1, lessons, notes: {}, drafts: {}, last: 'policy-strategy:5' });
  assert.equal(await page.locator('.ac-records li').count(), 1);
  await page.fill('#learner-name', 'Ama Test');
  await page.click('#name-form button');
  await page.goto(`${ctx.url}/learning.html#record/policy-strategy`);
  await page.locator('.ac-record').waitFor();
  assert.equal(await page.locator('.ac-record-name').textContent(), 'Ama Test');
  assert.match(await page.locator('.ac-record-fine').textContent(), /not an official TIME Inc\. certificate/);
  await page.goto(`${ctx.url}/learning.html#record/school-leadership`);
  await page.locator('#academy h1').first().waitFor();
  assert.match(await page.locator('#academy h1').first().textContent(), /Not finished yet/);
  await page.close();
});

test('courses can be saved for later, and text-only content is never treated as markup', async () => {
  const page = await academy('#courses');
  await page.click('[data-save="research-skills"]');
  assert.equal((await stored(page)).saved['research-skills'], true);
  await page.goto(`${ctx.url}/learning.html#my`);
  await page.locator('#academy h1').first().waitFor();
  assert.equal(await page.locator('.ac-grid .ac-card h3', { hasText: 'Research Skills' }).count(), 1);
  await page.fill('#learner-name', '<img src=x onerror=alert(1)>');
  await page.click('#name-form button');
  await page.locator('#academy h1').first().waitFor();
  assert.equal(await page.locator('#academy img[src="x"]').count(), 0);
  await page.close();
});

test('focus mode hides everything but the lesson, and the assignment draft counts words', async () => {
  const page = await academy('#lesson/standard-english/2', DESKTOP);
  await page.click('#focus-mode');
  assert.ok(await page.locator('.site-header').isHidden());
  assert.ok(await page.locator('.ac-toc').isHidden());
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.site-header').isVisible());
  await page.goto(`${ctx.url}/learning.html#assignments/standard-english`);
  await page.locator('#assignment-draft').waitFor();
  await page.fill('#assignment-draft', 'one two three');
  assert.equal(await page.locator('#word-count').textContent(), '3 words');
  assert.equal((await stored(page)).drafts['standard-english'], 'one two three');
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('the account pages use the site design and keep everything the live sign-in needs', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['account.html', 'student-login.html', 'lecturer-login.html', 'admin-login.html']) {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const need of ['id="workspace"', 'id="toast"', 'id="request-indicator"', 'id="request-message"', 'id="loading-detail"', 'class="skip-link skip"', 'account.bundle.js', 'workspace.css', 'class="site-header"', 'class="ac-nav"', 'name="robots" content="noindex"']) {
      assert.ok(html.includes(need), `${file} has ${need}`);
    }
    assert.ok(!html.includes('portal.css'), `${file} no longer loads the old stylesheet`);
  }
  assert.match(readFileSync(new URL('../student-login.html', import.meta.url), 'utf8'), /<body data-page="workspace" data-portal="student">/);
  const { execFileSync } = await import('node:child_process');
  const before = readFileSync(new URL('../assets/learning/workspace.css', import.meta.url), 'utf8');
  execFileSync('node', ['scripts/workspace-css.mjs'], { cwd: new URL('..', import.meta.url) });
  assert.equal(readFileSync(new URL('../assets/learning/workspace.css', import.meta.url), 'utf8'), before, 'run: node scripts/workspace-css.mjs');
});
