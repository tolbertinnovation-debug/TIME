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

test('contact form does not send incomplete or bot submissions', async () => {
  const page = await contactPage({ success: 'true' });
  await page.click('#contact-form button[type=submit]');
  await fillForm(page);
  await page.fill('#f-email', 'not-an-email');
  await page.click('#contact-form button[type=submit]');
  await fillForm(page);
  await page.fill('#f-honey', 'spam');
  await page.click('#contact-form button[type=submit]');
  await page.waitForTimeout(300);
  assert.equal(page.posts.length, 0);
  await page.close();
});

test('"Join our team" and "Become a partner" preselect the form topic', async () => {
  const page = await openPage(ctx, 'contact.html', DESKTOP);
  await page.click('a[data-topic="Volunteering"]');
  assert.equal(await page.inputValue('#f-topic'), 'Volunteering');
  await page.close();
});
