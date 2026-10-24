import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { DESKTOP, PHONE, SITE_PAGES, openPage, read, settle, useBrowser } from './helpers.mjs';
import { buildKnowledge } from '../scripts/assistant-knowledge.mjs';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const ctx = useBrowser();
const data = JSON.parse(read('data/assistant.json'));
const knowledge = JSON.parse(read('data/assistant-knowledge.json'));

async function openChat(path = 'index.html', viewport = PHONE, options = {}) {
  const page = await openPage(ctx, path, viewport, options);
  await page.click('.chat-launcher');
  await page.locator('#time-assistant').waitFor({ state: 'visible' });
  return page;
}
const lastReply = (page) => page.locator('.chat-msg.bot').last();

test('every public page has the chat button, and its code loads only when opened', async () => {
  for (const file of SITE_PAGES) assert.match(read(file), /class="chat-launcher"/, `${file} has the chat button`);
  const page = await openPage(ctx, 'index.html', DESKTOP);
  const loaded = [];
  page.on('request', (r) => loaded.push(r.url()));
  await page.waitForTimeout(200);
  assert.ok(!loaded.some((u) => /assistant/.test(u)), 'nothing is downloaded before the visitor asks');
  await page.click('.chat-launcher');
  await page.locator('#time-assistant').waitFor({ state: 'visible' });
  assert.equal(await page.getAttribute('.chat-launcher', 'aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'chat-q', 'focus moves to the question box');
  assert.match(await page.locator('.chat-msg.bot').first().textContent(), /TIME Assistant/);
  assert.deepEqual(page.problems, []);
  await page.close();
});

test('quick replies answer with the approved fees and dates', async () => {
  const page = await openChat();
  await page.click('.chat-quick button:has-text("Fees")');
  const fees = await lastReply(page).textContent();
  for (const amount of ['US$80', 'LRD 13,600', 'US$125', 'US$175', 'US$15', 'US$10']) assert.ok(fees.includes(amount), `fees mention ${amount}`);
  assert.equal(await lastReply(page).locator('a[href="admissions.html#fees"]').count(), 1);
  await page.click('.chat-quick button:has-text("2027 dates")');
  assert.match(await lastReply(page).textContent(), /January 4, 2027[\s\S]*March 8, 2027[\s\S]*October 14, 2027/);
  await page.close();
});

test('typed questions are understood', async () => {
  const page = await openChat();
  const cases = [
    ['when do classes start?', /March 8, 2027/],
    ['Can I pay in installments', /US\$40/],
    ['Where are you located?', /Tower Hill/],
    ['Do you teach QuickBooks?', /QuickBooks/],
    ['what time are the saturday classes', /8:00 AM – 3:00 PM/],
    ['Is TIME Inc. accredited?', /Ministry of Education/],
  ];
  for (const [question, expected] of cases) {
    await page.fill('#chat-q', question);
    await page.press('#chat-q', 'Enter');
    await page.locator('.chat-msg.user', { hasText: question }).waitFor();
    assert.match(await lastReply(page).textContent(), expected, question);
  }
  assert.equal(await page.inputValue('#chat-q'), '', 'the box clears after sending');
  await page.close();
});

test('it answers from anything on the website, with a link to the section', async () => {
  const page = await openChat();
  const cases = [
    ['How many books has Dr. Saywrayne written?', /12 books/, 'founder.html'],
    ['Who is the principal of PHICA?', /Gbassagee/, ''],
    ['What is your vision?', /God-given potential/, 'about.html'],
    ['What happened at Kpehpue Town?', /122/, ''],
    ['Who teaches drug dispensing?', /Mr\. Bee/, ''],
    ['Which counties do you serve?', /Grand Bassa/, ''],
  ];
  for (const [question, expected, link] of cases) {
    await page.fill('#chat-q', question);
    await page.press('#chat-q', 'Enter');
    await page.locator('.chat-msg.user', { hasText: question }).waitFor();
    await page.waitForFunction(() => document.querySelector('.chat-log').lastElementChild.classList.contains('bot'));
    assert.match(await lastReply(page).textContent(), expected, question);
    if (link) assert.ok(await lastReply(page).locator(`a[href^="${link}"]`).count() >= 1, `${question} links to ${link}`);
  }
  await page.fill('#chat-q', 'How much is the diploma?');
  await page.press('#chat-q', 'Enter');
  await page.locator('.chat-msg.user', { hasText: 'How much is the diploma?' }).waitFor();
  await page.waitForFunction(() => document.querySelector('.chat-log').lastElementChild.classList.contains('bot'));
  const fee = await lastReply(page).textContent();
  assert.match(fee, /US\$175/);
  assert.doesNotMatch(fee, /US\$80/, 'only the line that was asked about');
  await page.close();
});

test('the website knowledge is up to date and covers every public page', () => {
  assert.equal(read('data/assistant-knowledge.json'), buildKnowledge(), 'run: npm run assistant');
  const covered = new Set(knowledge.passages.map((p) => p.u.split(/[?#]/)[0]));
  for (const file of SITE_PAGES.filter((f) => !['404.html', 'offline.html', 'search.html'].includes(f))) {
    assert.ok(covered.has(file), `${file} is in the assistant's knowledge`);
  }
  assert.doesNotMatch(read('assets/search-index.json'), /<!--|-->/, 'HTML comments (such as placeholder payment numbers) never reach site search');
  for (const p of knowledge.passages) assert.ok(p.t.length > 0 && p.h.length > 0 && !/[<>]/.test(p.t), `clean passage: ${p.u}`);
});

test('questions it cannot answer go to a person on WhatsApp with the question filled in', async () => {
  const page = await openChat();
  await page.fill('#chat-q', 'Do you offer nursing?');
  await page.click('.chat-send');
  const wa = lastReply(page).locator('a[href^="https://wa.me/231888901848"]');
  await wa.waitFor();
  assert.match(await wa.getAttribute('href'), /text=.*nursing/);
  assert.equal(await wa.getAttribute('target'), '_blank');
  assert.equal(await wa.getAttribute('rel'), 'noopener');
  assert.equal(await lastReply(page).locator('a[href*="contact.html"]').count(), 1);
  await page.close();
});

test('the official Mobile Money number is the same on every page and in the chat', async () => {
  const number = '0888 901 848', name = 'Philip V. Saywrayne';
  for (const file of ['donate.html', 'admissions.html', 'faq.html']) {
    const html = read(file);
    assert.ok(html.includes(number) && html.includes(name), `${file} shows the Mobile Money number and name`);
  }
  for (const file of SITE_PAGES) {
    const numbers = read(file).match(/\b0(?:77|88)\d \d{3} \d{3}\b/g) || [];
    assert.deepEqual([...new Set(numbers)].filter((n) => n !== number), [], `${file} has no other Mobile Money number`);
  }
  const page = await openChat();
  await page.fill('#chat-q', 'How do I pay?');
  await page.press('#chat-q', 'Enter');
  await page.locator('.chat-msg.user', { hasText: 'How do I pay?' }).waitFor();
  assert.match(await lastReply(page).textContent(), /0888 901 848[\s\S]*Philip V\. Saywrayne/);
  await page.close();
});

test('typed text is shown as text, never as markup', async () => {
  const page = await openChat();
  await page.fill('#chat-q', '<img src=x onerror=alert(1)>');
  await page.press('#chat-q', 'Enter');
  await page.locator('.chat-msg.user').last().waitFor();
  assert.equal(await page.locator('.chat img[src="x"]').count(), 0);
  assert.equal(await page.locator('.chat-msg.user').last().textContent(), '<img src=x onerror=alert(1)>');
  await page.close();
});

test('Escape closes the chat, returns focus, and the conversation carries over to the next page', async () => {
  const page = await openChat();
  await page.click('.chat-quick button:has-text("Location")');
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#time-assistant').isHidden());
  assert.equal(await page.evaluate(() => document.activeElement.className), 'chat-launcher');
  assert.equal(await page.getAttribute('.chat-launcher', 'aria-expanded'), 'false');
  await page.goto(`${ctx.url}/programs.html`);
  await page.click('.chat-launcher');
  await page.locator('.chat-msg.user', { hasText: 'Where are you located?' }).waitFor();
  await page.close();
});

test('the chat stays clear of the phone action bar and fits the screen', async () => {
  const page = await openPage(ctx, 'index.html', PHONE);
  const button = await page.locator('.chat-launcher').boundingBox();
  const bar = await page.locator('.action-bar').boundingBox();
  assert.ok(button.y + button.height <= bar.y, 'button sits above the action bar');
  await page.click('.chat-launcher');
  const panel = await page.locator('#time-assistant').boundingBox();
  assert.ok(panel.y >= 0 && panel.y + panel.height <= bar.y + 1 && panel.x >= 0 && panel.x + panel.width <= PHONE.width);
  await page.close();
});

for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
  test(`the open chat has no WCAG 2.1 A/AA violations on ${label}`, async () => {
    const page = await openChat('index.html', viewport, { bypassCSP: true });
    await page.click('.chat-quick button:has-text("How to apply")');
    await settle(page);
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document.getElementById('time-assistant'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    });
    assert.deepEqual(violations, []);
    await page.close();
  });
}

test('assistant fees and dates match the Fees & Admissions and PHICA pages', () => {
  const admissions = read('admissions.html') + read('phica.html');
  const text = JSON.stringify(data);
  for (const amount of new Set(text.match(/US\$\d+|LRD [\d,]+/g))) {
    assert.ok(admissions.includes(amount), `${amount} in the assistant also appears on admissions.html or phica.html`);
  }
  for (const date of ['January 4, 2027', 'March 8, 2027', 'October 14, 2027']) {
    assert.ok(admissions.includes(date) && text.includes(date), `${date} on both`);
  }
  for (const intent of data.intents) {
    for (const link of intent.links || []) {
      const file = link.href.split(/[?#]/)[0];
      if (!/^https:/.test(link.href)) assert.doesNotThrow(() => read(file), `${intent.id} links to ${file}`);
    }
  }
});
