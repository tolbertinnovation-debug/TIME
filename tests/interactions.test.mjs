import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESKTOP, PHONE, openPage, settle, useBrowser } from './helpers.mjs';

const ctx = useBrowser();

test('mobile menu opens, closes with Escape and returns focus', async () => {
  const page = await openPage(ctx, 'index.html', PHONE);
  const toggle = page.locator('.nav-toggle');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await page.locator('#site-nav a[href="programs.html"]').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'nav-toggle');
  await page.close();
});

test('program tabs switch with clicks and arrow keys', async () => {
  const page = await openPage(ctx, 'programs.html', DESKTOP);
  const tabs = page.locator('[data-tabs] [role="tab"]');
  const count = await tabs.count();
  assert.ok(count >= 2);
  await tabs.nth(1).click();
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
  assert.ok(await page.locator(`#${await tabs.nth(1).getAttribute('aria-controls')}`).isVisible());
  await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(2 % count).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  await page.close();
});

test('course search filters every category and shows an empty state', async () => {
  const page = await openPage(ctx, 'programs.html', DESKTOP);
  await page.fill('#course-q', 'quickbooks');
  assert.match(await page.locator('.course-count').textContent(), /^1 course$/);
  assert.ok(await page.locator('.course-list li:not(.hidden)', { hasText: 'QuickBooks' }).first().isVisible());
  await page.fill('#course-q', 'zzzz-no-course');
  assert.ok(await page.locator('.course-empty').isVisible());
  await page.fill('#course-q', '');
  assert.equal(await page.locator('.course-count').textContent(), '');
  await page.close();
});

test('gallery lightbox opens, pages through photos and closes with Escape', async () => {
  const page = await openPage(ctx, 'impact.html', DESKTOP);
  await settle(page);
  const first = page.locator('.gallery [data-lightbox]').first();
  await first.evaluate((b) => b.click());
  const box = page.locator('.lightbox');
  assert.ok(await box.evaluate((el) => el.classList.contains('open')));
  const caption1 = await box.locator('figcaption').textContent();
  await page.keyboard.press('ArrowRight');
  assert.notEqual(await box.locator('figcaption').textContent(), caption1);
  await page.waitForFunction(() => document.querySelector('.lightbox img').naturalWidth > 0);
  await page.keyboard.press('Escape');
  assert.ok(!(await box.evaluate((el) => el.classList.contains('open'))));
  await page.close();
});

// --- contact form -------------------------------------------------------------------

async function contactPage(reply) {
  const page = await openPage(ctx, 'contact.html', PHONE);
  page.posts = [];
  await page.route('https://formsubmit.co/**', async (route) => {
    page.posts.push(route.request().postDataJSON());
    if (reply === 'network') return route.abort();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  return page;
}

async function fillForm(page) {
  await page.fill('#f-name', 'Ama Test');
  await page.fill('#f-email', 'ama@example.com');
  await page.fill('#f-msg', 'I would like to register for a course.');
}

test('contact form sends the message and clears on success', async () => {
  const page = await contactPage({ success: 'true' });
  await fillForm(page);
  await page.click('#contact-form button[type=submit]');
  await page.locator('.form-status', { hasText: 'Thank you' }).waitFor();
  assert.equal(page.posts.length, 1);
  assert.equal(page.posts[0].email, 'ama@example.com');
  assert.match(page.posts[0]._subject, /Message from Ama Test/);
  assert.equal(await page.inputValue('#f-name'), '');
  await page.close();
});

test('contact form keeps the message and offers email/WhatsApp when sending fails', async () => {
  for (const reply of [{ success: 'false', message: 'This form needs Activation.' }, 'network']) {
    const page = await contactPage(reply);
    await fillForm(page);
    await page.click('#contact-form button[type=submit]');
    await page.locator('.form-status', { hasText: "couldn't send" }).waitFor();
    assert.equal(await page.inputValue('#f-name'), 'Ama Test');
    assert.match(await page.locator('.form-status a[href^="mailto:"]').getAttribute('href'), /tinstitute312%40gmail\.com|tinstitute312@gmail\.com/);
    assert.match(await page.locator('.form-status a[href^="https://wa.me/"]').getAttribute('href'), /text=/);
    assert.ok(await page.locator('#contact-form button[type=submit]').isEnabled());
    await page.close();
  }
});

test('contact form shows inline errors and does not send incomplete or bot submissions', async () => {
  const page = await contactPage({ success: 'true' });
  await page.click('#contact-form button[type=submit]');
  assert.equal(await page.locator('#f-name-error').textContent(), 'Please enter your name.');
  assert.equal(await page.locator('#f-email-error').textContent(), 'Please enter your email address.');
  assert.equal(await page.locator('#f-msg-error').textContent(), 'Please enter a message.');
  assert.equal(await page.getAttribute('#f-name', 'aria-invalid'), 'true');
  assert.match(await page.getAttribute('#f-name', 'aria-describedby'), /f-name-error/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'f-name', 'focus moves to the first problem');

  await fillForm(page);
  assert.equal(await page.locator('#f-name-error').count(), 0, 'errors clear as the user fixes them');
  await page.fill('#f-email', 'not-an-email');
  await page.click('#contact-form button[type=submit]');
  assert.match(await page.locator('#f-email-error').textContent(), /valid email address/);

  await fillForm(page);
  await page.fill('#f-honey', 'spam');
  await page.click('#contact-form button[type=submit]');
  await page.waitForTimeout(300);
  assert.equal(page.posts.length, 0);
  await page.close();
});

test('message counter tracks length and the limit is enforced', async () => {
  const page = await openPage(ctx, 'contact.html', PHONE);
  await page.fill('#f-msg', 'Hello');
  assert.equal(await page.locator('#f-msg-count').textContent(), '5 / 4,000 characters');
  await page.fill('#f-msg', 'x'.repeat(4100));
  assert.equal((await page.inputValue('#f-msg')).length, 4000);
  await page.close();
});

test('links can open the form with a topic chosen', async () => {
  const page = await openPage(ctx, 'contact.html?topic=Becoming%20a%20partner#contact-form', PHONE);
  assert.equal(await page.inputValue('#f-topic'), 'Becoming a partner');
  await page.close();
  const unknown = await openPage(ctx, 'contact.html?topic=%3Cscript%3E', PHONE);
  assert.equal(await unknown.inputValue('#f-topic'), 'Registering for a course', 'unknown topics are ignored');
  await unknown.close();
});

test('FAQ search filters questions, opens a few matches and shows an empty state', async () => {
  const page = await openPage(ctx, 'faq.html', PHONE);
  const total = await page.locator('.faq-group details').count();
  await page.fill('#faq-q', 'installments');
  const visible = page.locator('.faq-group details:not([hidden])');
  const n = await visible.count();
  assert.ok(n >= 1 && n < total);
  assert.match(await page.locator('#faq-count').textContent(), /^\d+ questions? match/);
  assert.ok(await visible.first().evaluate((d) => d.open), 'matching answers open');
  await page.fill('#faq-q', 'qqqq nothing');
  assert.ok(await page.locator('.faq-empty').isVisible());
  assert.equal(await page.locator('.faq-group:not([hidden])').count(), 0);
  await page.fill('#faq-q', '');
  assert.equal(await page.locator('.faq-group details:not([hidden])').count(), total);
  assert.ok(!(await page.locator('.faq-empty').isVisible()));
  await page.close();
});

test('"Join our team" and "Become a partner" preselect the form topic', async () => {
  const page = await openPage(ctx, 'contact.html', DESKTOP);
  await page.click('a[data-topic="Volunteering"]');
  assert.equal(await page.inputValue('#f-topic'), 'Volunteering');
  await page.close();
});

test('news filters show one topic at a time and can return to all stories', async () => {
  const page = await openPage(ctx, 'news.html', PHONE);
  const items = page.locator('.news-item');
  const total = await items.count();
  assert.ok(total >= 5);
  await page.click('.news-filter[data-filter="outreach"]');
  assert.equal(await page.getAttribute('.news-filter[data-filter="outreach"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('.news-filter[data-filter="all"]', 'aria-pressed'), 'false');
  const shown = await page.locator('.news-item:not([hidden])').count();
  assert.ok(shown > 0 && shown < total);
  assert.equal(await page.locator('.news-item:not([hidden]):not([data-category="outreach"])').count(), 0);
  assert.match(await page.locator('.news-count').textContent(), /stor(y|ies) about Outreach/);
  await page.click('.news-filter[data-filter="all"]');
  assert.equal(await page.locator('.news-item:not([hidden])').count(), total);
  await page.close();
});
