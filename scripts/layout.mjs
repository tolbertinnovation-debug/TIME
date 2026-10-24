// Keeps the shared page parts (top bar, header, footer, phone action bar) identical on every page.
// Edit the files in partials/, then run `npm run layout` to copy them into each page.
// `npm run layout -- --check` (used by the tests) reports pages that are out of date without changing them.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORTAL = new Set(['learning.html', 'account.html', 'student-login.html', 'lecturer-login.html', 'admin-login.html']);

// Each region runs from its opening tag to its closing marker.
const REGIONS = [
  { name: 'topbar', start: '<div class="topbar"', end: '</div>\n  </div>' },
  { name: 'header', start: '<header class="site-header">', end: '</header>' },
  { name: 'footer', start: '<footer class="site-footer">', end: '</footer>' },
  { name: 'tail', start: '<nav class="action-bar"', end: '</aside>' },
];

export const pages = () => readdirSync(ROOT).filter((f) => f.endsWith('.html') && !PORTAL.has(f)).sort();

function partial(name, page) {
  let html = readFileSync(join(ROOT, 'partials', `${name}.html`), 'utf8').trimEnd();
  // Mark the current page in the main menu (not the Support Us button).
  if (name === 'header') html = html.replace(new RegExp(`<a href="${page.replace('.', '\\.')}">`), `<a href="${page}" aria-current="page">`);
  return html;
}

export function render(page, html) {
  for (const { name, start, end } of REGIONS) {
    const i = html.indexOf(start);
    if (i < 0) throw new Error(`${page}: missing ${name} (${start})`);
    const j = html.indexOf(end, i);
    if (j < 0) throw new Error(`${page}: ${name} is not closed (${end})`);
    html = html.slice(0, i) + partial(name, page) + html.slice(j + end.length);
  }
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const page of pages()) {
    const file = join(ROOT, page);
    const before = readFileSync(file, 'utf8');
    const after = render(page, before);
    if (after === before) continue;
    stale.push(page);
    if (!check) writeFileSync(file, after);
  }
  if (check && stale.length) {
    console.error(`Out of date with partials/: ${stale.join(', ')}. Run: npm run layout`);
    process.exit(1);
  }
  console.log(check ? 'All pages match partials/.' : stale.length ? `Updated: ${stale.join(', ')}` : 'All pages already up to date.');
}
