import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, after } from 'node:test';
import { chromium } from 'playwright';
import { ROOT, startServer } from './serve.mjs';

// Pages of the public website (the learning portal pages are rendered by their own scripts).
export const PORTAL_PAGES = ['learning.html', 'account.html', 'student-login.html', 'lecturer-login.html', 'admin-login.html'];
export const ALL_PAGES = readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
export const SITE_PAGES = ALL_PAGES.filter((f) => !PORTAL_PAGES.includes(f));
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1366, height: 900 };

export const read = (file) => readFileSync(join(ROOT, file), 'utf8');

// Shared browser + server for a test file.
export function useBrowser() {
  const ctx = {};
  before(async () => {
    const { server, url } = await startServer();
    ctx.server = server;
    ctx.url = url;
    ctx.browser = await chromium.launch();
  });
  after(async () => {
    await ctx.browser?.close();
    ctx.server?.close();
  });
  return ctx;
}

// Opens a page that records script errors and failed same-origin requests.
export async function openPage(ctx, path, viewport = PHONE, options = {}) {
  const page = await ctx.browser.newPage({ viewport, ...options });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`script error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().startsWith(ctx.url) && r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  // Never reach out to third parties from tests.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  page.problems = problems;
  await page.goto(`${ctx.url}/${path}`, { waitUntil: 'load' });
  return page;
}

// Load lazy images and finish scroll-in animations so the page is in its final state.
export async function settle(page) {
  await page.$$eval('img[loading=lazy]', (imgs) => imgs.forEach((i) => { i.loading = 'eager'; }));
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')));
  await page.waitForLoadState('networkidle');
}
