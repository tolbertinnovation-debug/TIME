// Builds assets/search-index.json for the site search (search.html) from the public pages:
// one entry per page, plus one per course and one per FAQ question so they can be found directly.
// `npm run search` writes the index; `npm run search -- --check` reports when it is stale (used by the tests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, pages } from './layout.mjs';
import { DATA as PROGRAMS } from './programs.mjs';

const OUT = join(ROOT, 'assets/search-index.json');
const SKIP = new Set(['404.html', 'offline.html', 'search.html']);

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&hellip;/g, '…');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const between = (html, a, b) => { const i = html.indexOf(a); if (i < 0) return ''; const j = html.indexOf(b, i); return j < 0 ? '' : html.slice(i + a.length, j); };

function pageEntry(file, html) {
  const title = text(html.match(/<title>([^<]*)<\/title>/)[1]).replace(/\s*\|\s*TIME Inc\..*$/, '');
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '');
  let body = between(html, '<main id="main">', '</main>')
    .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<nav class="page-links"[\s\S]*?<\/nav>/g, '');
  const headings = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g)].map((m) => text(m[1])).filter(Boolean);
  return { url: file === 'index.html' ? './' : file, title, description, headings: headings.slice(0, 30), text: text(body).slice(0, 3000) };
}

export function buildIndex() {
  const entries = [];
  for (const file of pages().filter((f) => !SKIP.has(f))) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
    entries.push({ type: 'page', ...pageEntry(file, html) });
  }
  // The study portal renders with JavaScript, so index its title and description only.
  const learning = readFileSync(join(ROOT, 'learning.html'), 'utf8');
  entries.push({ type: 'page', url: 'learning.html', title: 'TIME Learning: online courses and study guides',
    description: decode(learning.match(/<meta name="description" content="([^"]*)"/)[1]), headings: ['Online learning', 'Student sign-in'], text: '' });
  for (const p of PROGRAMS) {
    for (const c of p.courses) {
      entries.push({ type: 'course', url: `${p.file}#courses`, title: c.detail ? `${c.name} (${c.detail})` : c.name,
        description: `${p.name.replace(/"/g, '“')}. ${p.summary}${c.lecturer ? ` Lecturer: ${c.lecturer}.` : ''}`, headings: [p.short], text: '' });
    }
  }
  const faq = readFileSync(join(ROOT, 'faq.html'), 'utf8');
  for (const m of faq.matchAll(/<details><summary>([\s\S]*?)<\/summary><div class="answer">([\s\S]*?)<\/div><\/details>/g)) {
    const q = text(m[1]);
    entries.push({ type: 'faq', url: `faq.html?q=${encodeURIComponent(q)}`, title: q, description: text(m[2]).slice(0, 300), headings: ['FAQ'], text: '' });
  }
  return JSON.stringify({ version: 1, entries }) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = buildIndex();
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (process.argv.includes('--check')) {
    if (current !== json) { console.error('assets/search-index.json is out of date. Run: npm run search'); process.exit(1); }
    console.log('Search index is up to date.');
  } else {
    if (current !== json) writeFileSync(OUT, json);
    console.log(`Search index: ${JSON.parse(json).entries.length} entries, ${Math.round(json.length / 1024)} KB`);
  }
}
