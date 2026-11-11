// Builds data/assistant-knowledge.json for the TIME Assistant chat from the public pages: every
// section is cut into short passages (a heading and the text under it), with a link back to the
// section, so the assistant can answer from anything published on the website. Courses come from
// data/programs.json so the assistant can recognise a course by name.
// `npm run assistant` writes the file; the tests fail when it is out of date.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, pages } from './layout.mjs';
import { DATA as PROGRAMS } from './programs.mjs';

const OUT = join(ROOT, 'data/assistant-knowledge.json');
const SKIP = new Set(['404.html', 'offline.html', 'search.html', 'account.html', 'student-login.html', 'lecturer-login.html', 'admin-login.html']);
const MAX = 520; // characters per passage

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&rsquo;|&lsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
  .replace(/&hellip;/g, '…').replace(/&times;/g, '×').replace(/&middot;/g, '·');
const clean = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Turn a page's <main> into a stream of lines, with markers for headings (§H) and link targets (§A).
function lines(html) {
  let body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  body = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|svg|picture|button|template|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<nav class="page-links"[\s\S]*?<\/nav>/g, ' ')
    .replace(/<p class="crumbs">[\s\S]*?<\/p>/g, ' ')
    .replace(/<a\b[^>]*class="[^"]*(?:btn|card-link)[^"]*"[^>]*>[\s\S]*?<\/a>/g, ' ')
    .replace(/<(\w+)\b[^>]*aria-hidden="true"[^>]*>[^<]*<\/\1>/g, ' ')
    // Labels (eyebrows, roles, dates) sit above their heading; move them under it so they join its passage.
    .replace(/(<(span|p)\b[^>]*class="[^"]*(?:eyebrow|role|news-meta|chip)[^"]*"[^>]*>[\s\S]*?<\/\2>)\s*(<h[1-4]\b[^>]*>[\s\S]*?<\/h[1-4]>)/g, '$3\n$1</p>')
    .replace(/<summary>([\s\S]*?)<\/summary>/g, (m, q) => `\n§Q§${clean(q)}\n`)
    .replace(/<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g, (m, n, attrs, t) => `\n§H§${(attrs.match(/\bid="([^"]+)"/) || [])[1] || ''}§${clean(t)}\n`)
    .replace(/<[a-z]+\b[^>]*\bid="([^"]+)"[^>]*>/g, (m, id) => `\n§A§${id}\n${m}`)
    .replace(/<\/(td|th|dt)>/g, ' · ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/(p|li|tr|div|figcaption|blockquote|dd|section|article|ul|ol|dl|table|header|aside)>/g, '\n');
  return body.split('\n').map((l) => (l.startsWith('§') ? l : clean(l).replace(/(\s·)+\s*$/, '').replace(/^·\s*/, ''))).filter(Boolean);
}

function pagePassages(file, html) {
  const page = clean(html.match(/<title>([^<]*)<\/title>/)[1]).replace(/\s*\|\s*TIME Inc\..*$/, '');
  const url = file === 'index.html' ? 'index.html' : file;
  const out = [];
  let anchor = '', heading = page, link = url, text = [];
  const flush = () => {
    const t = text.join(' ').trim();
    if (t) out.push({ u: link, p: page, h: heading, t });
    text = [];
  };
  for (const line of lines(html)) {
    if (line.startsWith('§A§')) { anchor = line.slice(3) === 'main' ? '' : line.slice(3); continue; }
    if (line.startsWith('§H§') || line.startsWith('§Q§')) {
      flush();
      if (line.startsWith('§Q§')) {
        heading = line.slice(3);
        link = `faq.html?q=${encodeURIComponent(heading)}`;
      } else {
        const [, id, title] = line.split('§').slice(1);
        heading = title || page;
        if (id && id !== 'main') anchor = id;
        link = anchor ? `${url}#${anchor}` : url;
      }
      continue;
    }
    text.push(line.length < 80 && !/[.!?:…]$/.test(line) ? `${line}.` : line);
    if (text.join(' ').length > MAX) flush();
  }
  flush();
  return out;
}

export function buildKnowledge() {
  const passages = [];
  for (const file of pages().filter((f) => !SKIP.has(f))) {
    const html = readFileSync(join(ROOT, file), 'utf8');
    // The study portal renders with JavaScript; describe it from its meta description.
    if (file === 'learning.html') {
      passages.push({ u: 'learning.html', p: 'TIME Learning', h: 'Online learning', t: clean(html.match(/<meta name="description" content="([^"]*)"/)[1]) });
      continue;
    }
    passages.push(...pagePassages(file, html));
  }
  const courses = PROGRAMS.flatMap((p) => p.courses.map((c) => ({
    n: c.detail ? `${c.name} (${c.detail})` : c.name, g: p.short, u: `${p.file}#courses`, ...(c.lecturer ? { l: c.lecturer } : {}),
  })));
  return JSON.stringify({ version: 1, passages, courses }) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = buildKnowledge();
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== json) writeFileSync(OUT, json);
  const data = JSON.parse(json);
  console.log(`Assistant knowledge: ${data.passages.length} passages, ${data.courses.length} courses, ${Math.round(json.length / 1024)} KB`);
}
