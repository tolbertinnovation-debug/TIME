// Builds one page per program (programs-*.html) from data/programs.json.
// The page head comes from programs.html, the class schedule from admissions.html and the layout from partials/,
// so the program pages always match the rest of the site.
// `npm run programs` writes the pages; `npm run programs -- --check` reports stale ones (used by the tests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, render } from './layout.mjs';

const SITE = 'https://tolbertinnovation-debug.github.io/TIME/';
const WA = 'https://wa.me/231888901848';
export const DATA = JSON.parse(readFileSync(join(ROOT, 'data/programs.json'), 'utf8')).programs;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => String(s).replace(/"/g, '“').replace(/“([^“]*)“/g, '“$1”');
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const WA_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.5 13.5 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.2-.6-.4zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6A11.8 11.8 0 0 0 12 23.8 11.8 11.8 0 0 0 20.4 3.6z"/></svg>';

// Responsive photo markup using the WebP sizes generated for every photo.
function photo(name, alt, sizes, extra = '') {
  const widths = [480, 960, 1600];
  const html = readFileSync(join(ROOT, 'impact.html'), 'utf8') + readFileSync(join(ROOT, 'index.html'), 'utf8') + readFileSync(join(ROOT, 'about.html'), 'utf8');
  const srcset = html.match(new RegExp(`srcset="([^"]*webp/${name}-480\\.webp[^"]*)"`))?.[1]
    || widths.map((w) => `assets/img/webp/${name}-${w}.webp ${w}w`).filter((c) => existsSync(join(ROOT, c.split(' ')[0]))).join(', ');
  const dims = html.match(new RegExp(`src="assets/img/${name}\\.jpg" width="(\\d+)" height="(\\d+)"`));
  const [w, h] = dims ? [dims[1], dims[2]] : ['1600', '1200'];
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img src="assets/img/${name}.jpg" width="${w}" height="${h}" alt="${esc(alt)}"${extra}></picture>`;
}

const byslug = Object.fromEntries(DATA.map((p) => [p.slug, p]));

function faq(p) {
  const items = [
    ['Is TIME Inc. accredited?', 'Yes. TIME Inc. is an accredited supplementary teacher-training institution under the Bureau of Teacher Education, Ministry of Education (MoE), Liberia, and has been registered with the Government of Liberia since January 2021.'],
    ['How much does this program cost?', p.feeAnswer],
    ...(p.online ? [] : [['What else should I know about fees?', 'Tuition covers instruction only unless stated in writing; admissions will tell you before you enroll whether learning materials, exams, certificate processing or internship costs are extra. Eligible PHICA staff, approved groups and early payers may receive a 50% tuition discount, subject to approval. All tuition must be paid before the exit examination, and you should pay only through official TIME Inc. channels and keep your receipts.']]),
    p.online
      ? ['How does the online part work?', 'You study the online part in TIME Learning: create a student account, verify your email address and request enrolment. Once TIME approves your enrolment, your lessons, quizzes, assignments and class schedule appear in your account. The in-person classes take place with your lecturers.']
      : ['When are classes held?', 'Most programs offer a weekday track (Monday, Wednesday and Friday, 3:00 PM – 6:00 PM) and a Saturday track (8:00 AM – 3:00 PM). Schedules vary by program, so confirm the timetable for your course with admissions.'],
    p.online
      ? ['When does the next cohort start?', 'Contact admissions for the start date of the next Special Education Support Training cohort.']
      : ['When does the next class start?', 'For the 2027 intake, register by Monday, January 4, 2027. Classes begin on Monday, March 8, 2027, and the following intake is on Thursday, October 14, 2027.'],
  ];
  return items.map(([q, a]) => `          <details><summary>${q}</summary><div class="answer"><p>${a}</p></div></details>`).join('\n');
}

function steps(p) {
  const s = p.online ? [
    ['Create your account', 'Open <a href="student-login.html">TIME Learning</a>, register as a student and verify your email address with the code we send you.'],
    ['Request your courses', 'Choose the courses you want to join. Your request shows as pending until it is reviewed.'],
    ['Get approved', 'TIME reviews your request and approves your enrolment. Use <em>Check approval</em> in your account to see the decision.'],
    ['Start learning', 'Open each course to find lessons, quizzes, assignments, class dates and announcements from your lecturers.'],
  ] : [
    ['Choose your course', `Pick the ${p.credential.toLowerCase()} course that fits your work and goals from the list above.`],
    ['Talk to admissions', `Call <a href="tel:+231880902568">+231 880 902 568</a> or <a href="${WA}" target="_blank" rel="noopener">message us on WhatsApp</a> to confirm your total fees and timetable, and whether you qualify for a discount.`],
    ['Register by January 4, 2027', 'Visit the Phìtìa Academy campus on Robertsfield Highway, Monday – Friday, 8:00 AM – 4:00 PM, and pay the registration fee where applicable.'],
    ['Pay and start on March 8', p.installments ? 'Pay your first installment when you register and the second before the exit examination. Keep every official receipt.' : 'Pay your tuition through an official TIME Inc. payment channel, keep your receipt, and start classes on March 8, 2027.'],
  ];
  return s.map(([t, d], i) => `          <li class="step reveal"><span class="step-n" aria-hidden="true">${i + 1}</span><div><h3 class="h4">${t}</h3><p>${d}</p></div></li>`).join('\n');
}

function courses(p) {
  return p.courses.map((c, i) => {
    const sub = c.lecturer ? `<small>Lecturer: ${esc(c.lecturer)}</small>` : c.detail ? `<small>${esc(c.detail)}</small>` : '';
    return `              <li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(c.name)}${sub}</span></li>`;
  }).join('\n');
}

function main(p, schedule) {
  const name = esc(plain(p.name));
  const waText = encodeURIComponent(`Hello TIME Inc., I would like to register for ${plain(p.name)}.`);
  const related = p.related.map((s) => byslug[s]).map((r) => `          <article class="card reveal">
            <span class="eyebrow">${esc(r.category)}</span>
            <h3>${esc(plain(r.name))}</h3>
            <p>${esc(r.summary)}</p>
            <a class="card-link" href="${r.file}">View program ${ARROW}</a>
          </article>`).join('\n');
  const when = p.online
    ? `        <div class="callout reveal">
          <h3>How the program is delivered</h3>
          <p>About 60% of the program is studied online in <a href="learning.html">TIME Learning</a>, where your lecturers publish lessons, quizzes, assignments and class dates. The other 40% is taught in person.</p>
        </div>`
    : `        <p class="lead reveal">Training schedules vary by program. Confirm the duration and timetable for your course with admissions.</p>\n        ${schedule}`;
  return `
    <section class="page-hero">
      <div class="bg">${photo(p.image, '', '100vw', ' style="object-position:center 35%"')}</div>
      <div class="wrap">
        <p class="crumbs"><a href="index.html">Home</a> &nbsp;/&nbsp; <a href="programs.html">Programs</a> &nbsp;/&nbsp; ${esc(plain(p.short))}</p>
        <span class="eyebrow light">${esc(p.category)}</span>
        <h1>${name}</h1>
        <p class="lead">${esc(p.lead)}</p>
      </div>
    </section>
    <nav class="page-links" aria-label="Explore this page"><div class="wrap"><span class="page-links-label">On this page</span><a href="#overview">Overview</a><a href="#courses">Courses</a><a href="#schedule">${p.online ? 'Delivery' : 'Schedule'}</a><a href="#enrol">How to enrol</a><a href="#questions">Questions</a></div></nav>

    <section class="section" id="overview">
      <div class="wrap split program-overview">
        <div class="reveal">
          <span class="eyebrow">Overview</span>
          <h2>Who it&rsquo;s for</h2>
          <ul class="check-list">
${p.who.map((w) => `            <li>${esc(w)}</li>`).join('\n')}
          </ul>
          <h2 class="h3-size">What you&rsquo;ll develop</h2>
          <ul class="check-list">
${p.learn.map((w) => `            <li>${esc(w)}</li>`).join('\n')}
          </ul>
        </div>
        <aside class="program-facts reveal" aria-label="Program at a glance">
          <h2 class="h4">At a glance</h2>
          <dl>
${p.facts.map(([k, v]) => `            <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
          </dl>
          <div class="btn-row">
            <a class="btn btn-primary" href="${WA}?text=${waText}" target="_blank" rel="noopener">${WA_ICON} Register via WhatsApp</a>
            <a class="btn btn-ghost" href="contact.html?topic=Registering%20for%20a%20course#contact-form">Ask a question</a>
          </div>
        </aside>
      </div>
    </section>

    <section class="section bg-white" id="courses">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">${esc(p.coursesTitle)}</span>
          <h2>${p.courses.length} ${/subject/i.test(p.coursesTitle) ? 'subject areas' : 'courses'} in this program</h2>
          <p class="lead">${esc(p.summary)}</p>
        </div>
        <div class="program-box reveal">
          <ul class="course-list">
${courses(p)}
          </ul>
        </div>
      </div>
    </section>

    <section class="section" id="schedule">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">${p.online ? 'Delivery' : 'Class schedule'}</span>
          <h2>${p.online ? 'Online and in person' : 'Choose the schedule that fits your life'}</h2>
        </div>
${when}
      </div>
    </section>

    <section class="section bg-white" id="enrol">
      <div class="wrap narrow">
        <div class="section-head reveal">
          <span class="eyebrow">How to enrol</span>
          <h2>Four steps to start</h2>
        </div>
        <ol class="steps">
${steps(p)}
        </ol>
      </div>
    </section>

    <section class="section faq" id="questions">
      <div class="wrap">
        <div class="faq-group reveal">
          <h2>Common questions</h2>
${faq(p)}
        </div>
        <p class="faq-more-link"><a href="faq.html">More answers in our FAQ</a></p>
      </div>
    </section>

    <section class="section bg-white" id="related">
      <div class="wrap">
        <div class="section-head reveal">
          <span class="eyebrow">You may also like</span>
          <h2>Related programs</h2>
        </div>
        <div class="grid grid-3">
${related}
        </div>
      </div>
    </section>

    <section class="section-sm">
      <div class="wrap">
        <div class="cta reveal">
          <div class="bg">${photo('children-books', '', '100vw', ' loading="lazy"')}</div>
          <span class="eyebrow light">Ready to start?</span>
          <h2>Take the next step in your education.</h2>
          <p>Registration is ongoing. Talk to our admissions team about fees, schedules and the next start date.</p>
          <div class="btn-row">
            <a class="btn btn-light" href="${WA}?text=${waText}" target="_blank" rel="noopener">Register via WhatsApp</a>
            <a class="btn btn-outline-light" href="programs.html">All programs</a>
          </div>
        </div>
      </div>
    </section>`;
}

function head(base, p) {
  const url = SITE + p.file;
  const title = `${plain(p.name)} | TIME Inc. Liberia`;
  const desc = `${p.lead} Accredited training at TIME Inc., Margibi County, Liberia.`;
  const breadcrumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
    { '@type': 'ListItem', position: 2, name: 'Programs', item: SITE + 'programs.html' },
    { '@type': 'ListItem', position: 3, name: plain(p.short), item: url }] };
  const provider = { '@type': 'EducationalOrganization', name: 'Technical Institute for Many Empowerment (TIME) Inc.', url: SITE };
  const list = { '@context': 'https://schema.org', '@type': 'ItemList', name: plain(p.name), itemListElement: p.courses.map((c, i) => ({
    '@type': 'ListItem', position: i + 1, item: { '@type': 'Course', name: c.detail ? `${c.name} (${c.detail})` : c.name, description: `${plain(p.name)}. ${p.summary}`, educationalCredentialAwarded: p.credential, provider,
      ...(p.tuition ? { offers: { '@type': 'Offer', category: 'Tuition', price: p.tuition, priceCurrency: 'USD' } } : {}) } })) };
  let h = base
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\s*/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${SITE}assets/img/${p.image}.jpg`)
    .replace(new RegExp(`${SITE}programs\\.html`, 'g'), url);
  return h.replace('</head>', `  <script type="application/ld+json">${JSON.stringify(breadcrumbs)}</script>\n  <script type="application/ld+json">${JSON.stringify(list)}</script>\n</head>`);
}

export function build(p) {
  const base = readFileSync(join(ROOT, 'programs.html'), 'utf8');
  const admissions = readFileSync(join(ROOT, 'admissions.html'), 'utf8');
  const i = admissions.indexOf('<div class="schedule">');
  const schedule = admissions.slice(i, admissions.indexOf('</div>\n        </div>', i) + '</div>\n        </div>'.length);
  const [top, rest] = base.split('<main id="main">');
  const bottom = rest.slice(rest.indexOf('</main>'));
  const page = head(top.slice(0, top.indexOf('</head>') + 7), p) + top.slice(top.indexOf('</head>') + 7).replace('data-page="programs"', 'data-page="program"')
    + '<main id="main">' + main(p, schedule) + '\n  ' + bottom;
  return render(p.file, page);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const p of DATA) {
    const file = join(ROOT, p.file);
    const html = build(p);
    if (existsSync(file) && readFileSync(file, 'utf8') === html) continue;
    stale.push(p.file);
    if (!check) writeFileSync(file, html);
  }
  if (check && stale.length) { console.error(`Out of date with data/programs.json: ${stale.join(', ')}. Run: npm run programs`); process.exit(1); }
  console.log(check ? 'Program pages are up to date.' : stale.length ? `Wrote: ${stale.join(', ')}` : 'Program pages already up to date.');
}
