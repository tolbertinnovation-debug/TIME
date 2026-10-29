/* TIME Learning: the online academy. Courses, learning paths, a course player with practice
   checks, notes, assignment drafts, learning records and backups. Everything is saved in this
   browser (key "time-learning-v1", compatible with the earlier portal and its backups).
   Official assignments, submissions, grades and certificates live in the account workspace. */
(function () {
  'use strict';
  const courses = window.TIME_COURSES || [];
  const root = document.getElementById('academy');
  if (!root || !courses.length) return;

  const KEY = 'time-learning-v1';
  const UNITS = 6;
  const PATHS = [
    { id: 'school-leader', title: 'School Leader', color: '#4e653b', icon: 'school',
      blurb: 'Lead a school with a clear vision, sound decisions and plans that get done.',
      courses: ['school-leadership', 'administrator-decisions', 'policy-strategy', 'project-management'] },
    { id: 'health-community', title: 'Health & Community Care', color: '#886047', icon: 'health',
      blurb: 'Safe medicine handling and well-run health services for your community.',
      courses: ['drug-dispensing', 'health-care-management', 'project-management'] },
    { id: 'research-communication', title: 'Research & Communication', color: '#3a7074', icon: 'pen',
      blurb: 'Read, write, speak and research with confidence in your professional work.',
      courses: ['standard-english', 'research-skills', 'policy-strategy'] }
  ];
  const ICONS = {
    Education: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    Leadership: '<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z"/>',
    Management: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 13h3M8 16h6"/>',
    'Academic skills': '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    Communication: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12Z"/>',
    Health: '<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9Z"/><path d="M12 9v6M9 12h6"/>',
    school: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    health: '<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9Z"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
  };
  const icon = (name, size) => '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.Education) + '</svg>';
  const ARROW = '<span aria-hidden="true">→</span>';

  // --- saved state (compatible with the earlier portal's format and backups) ----------
  const ids = new Set(courses.flatMap(c => c.modules.map((_, i) => c.id + ':' + i)));
  const courseIds = new Set(courses.map(c => c.id));
  const blank = () => ({ version: 1, lessons: {}, notes: {}, drafts: {}, last: null, attempts: {}, saved: {}, days: [], name: '', completedAt: {}, textSize: 0 });
  let state = blank();
  let storageAvailable = true;
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('Unrecognized backup format.');
    const clean = blank();
    for (const id of ids) {
      if (raw.lessons && raw.lessons[id] === true) clean.lessons[id] = true;
      if (raw.notes && typeof raw.notes[id] === 'string') clean.notes[id] = raw.notes[id].slice(0, 12000);
      if (raw.attempts && Number.isInteger(raw.attempts[id]) && raw.attempts[id] >= 0) clean.attempts[id] = Math.min(raw.attempts[id], 999);
    }
    for (const c of courses) {
      if (raw.drafts && typeof raw.drafts[c.id] === 'string') clean.drafts[c.id] = raw.drafts[c.id].slice(0, 30000);
      if (raw.saved && raw.saved[c.id] === true) clean.saved[c.id] = true;
      if (raw.completedAt && /^\d{4}-\d{2}-\d{2}$/.test(raw.completedAt[c.id] || '')) clean.completedAt[c.id] = raw.completedAt[c.id];
    }
    if (typeof raw.last === 'string' && ids.has(raw.last)) clean.last = raw.last;
    if (Array.isArray(raw.days)) clean.days = raw.days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(-400);
    if (typeof raw.name === 'string') clean.name = raw.name.slice(0, 80);
    if ([0, 1, 2].includes(raw.textSize)) clean.textSize = raw.textSize;
    return clean;
  }
  try { const raw = localStorage.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (_) { storageAvailable = false; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { storageAvailable = false; toast('Browser storage is unavailable. Download a backup before leaving.'); return false; }
  }
  const today = () => new Date().toISOString().slice(0, 10);
  function studied() {
    const d = today();
    if (state.days[state.days.length - 1] !== d) { state.days.push(d); state.days = state.days.slice(-400); }
  }

  // --- helpers -------------------------------------------------------------------------
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const byId = id => courses.find(c => c.id === id);
  const done = (c, i) => !!state.lessons[c.id + ':' + i];
  const count = c => c.modules.filter((_, i) => done(c, i)).length;
  const pct = c => Math.round(count(c) / UNITS * 100);
  const complete = c => count(c) === UNITS;
  const total = () => courses.reduce((n, c) => n + count(c), 0);
  const nextUnit = c => { const i = c.modules.findIndex((_, i) => !done(c, i)); return i < 0 ? 0 : i; };
  const courseURL = c => '#course/' + c.id;
  const lessonURL = (c, i) => '#lesson/' + c.id + '/' + i;
  const pathsFor = c => PATHS.filter(p => p.courses.includes(c.id));
  const pathCourses = p => p.courses.map(byId).filter(Boolean);
  const pathPct = p => { const cs = pathCourses(p); return Math.round(cs.reduce((n, c) => n + count(c), 0) / (cs.length * UNITS) * 100); };
  const lecturers = [...new Set(courses.map(c => c.lecturer))];
  const categories = [...new Set(courses.map(c => c.category))];
  function streak() {
    const set = new Set(state.days); let n = 0; const d = new Date();
    if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function toast(message) {
    const el = document.getElementById('ac-toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 4200);
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function guideText(c, i) {
    const m = c.modules[i], id = c.id + ':' + i;
    return 'UNIT ' + (i + 1) + ': ' + m[0] + '\n\n' + m[1] + '\n\n' + m.slice(2, 5).map((x, n) => (n + 1) + '. ' + x).join('\n\n') +
      '\n\nPRACTICE TASK\n' + m[5] + (state.notes[id] ? '\n\nYOUR NOTES\n' + state.notes[id] : '');
  }
  const ring = (p, size) => '<span class="ac-ring" style="--p:' + p + ';--s:' + (size || 54) + 'px" role="img" aria-label="' + p + '% complete"><span>' + p + '%</span></span>';
  const bar = (p, label) => '<div class="ac-bar" role="progressbar" aria-label="' + esc(label) + '" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + p + '%"></span></div>';
  const draftNote = '<p class="ac-note">These are draft study guides prepared for TIME Inc. lecturers to review. Practice checks are for your own learning, not official grades.</p>';

  // --- building blocks -------------------------------------------------------------------
  function thumb(c, big) {
    return '<div class="ac-thumb' + (big ? ' big' : '') + '" style="--c:' + c.color + '" aria-hidden="true"><span class="ac-thumb-code">' + esc(c.code) + '</span><span class="ac-thumb-icon">' + icon(c.category, big ? 40 : 30) + '</span></div>';
  }
  function card(c) {
    const p = pct(c), n = count(c);
    const status = complete(c) ? '<span class="ac-badge done">Completed</span>' : n ? '<span class="ac-badge go">In progress</span>' : '';
    return '<article class="ac-card" style="--c:' + c.color + '">' + thumb(c) +
      '<div class="ac-card-body"><div class="ac-card-meta"><span class="ac-chip">' + esc(c.category) + '</span>' + status + '</div>' +
      '<h3><a href="' + courseURL(c) + '">' + esc(c.title) + '</a></h3>' +
      '<p class="ac-card-by">' + esc(c.lecturer) + '</p>' +
      '<ul class="ac-card-facts"><li>6 units</li><li>6 practice checks</li><li>Self-paced</li></ul>' +
      (n ? '<div class="ac-card-progress"><span>' + n + ' of 6 units</span><span>' + p + '%</span></div>' + bar(p, c.title + ' progress') : '') +
      '</div><button class="ac-save' + (state.saved[c.id] ? ' on' : '') + '" type="button" data-save="' + c.id + '" aria-pressed="' + !!state.saved[c.id] + '" aria-label="Save ' + esc(c.title) + ' to My learning"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg></button></article>';
  }
  function pathCard(p) {
    const cs = pathCourses(p), pp = pathPct(p);
    return '<article class="ac-path" style="--c:' + p.color + '"><div class="ac-path-head"><span class="ac-path-icon">' + icon(p.icon, 26) + '</span>' + ring(pp, 52) + '</div>' +
      '<h3>' + esc(p.title) + '</h3><p>' + esc(p.blurb) + '</p><ol class="ac-path-list">' +
      cs.map(c => '<li class="' + (complete(c) ? 'done' : '') + '"><a href="' + courseURL(c) + '">' + esc(c.title) + '</a></li>').join('') +
      '</ol><p class="ac-path-foot">' + cs.length + ' courses · ' + cs.length * UNITS + ' units' + (pp === 100 ? ' · <a href="#path-record/' + p.id + '">Learning record</a>' : '') + '</p></article>';
  }
  function sectionHead(eyebrow, title, lead, link) {
    return '<div class="ac-head"><div><span class="eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(title) + '</h2>' + (lead ? '<p>' + esc(lead) + '</p>' : '') + '</div>' + (link || '') + '</div>';
  }
  function pageHero(eyebrow, title, lead, extra) {
    return '<section class="ac-hero ac-hero-sm"><div class="wrap"><span class="eyebrow light">' + esc(eyebrow) + '</span><h1>' + title + '</h1>' + (lead ? '<p class="lead">' + esc(lead) + '</p>' : '') + (extra || '') + '</div></section>';
  }
  function continueCard() {
    const last = state.last && state.last.split(':');
    const c = last && byId(last[0]);
    if (!c) return '';
    const i = complete(c) ? Number(last[1]) : nextUnit(c);
    return '<a class="ac-continue" href="' + lessonURL(c, i) + '" style="--c:' + c.color + '">' + thumb(c) + '<span class="ac-continue-text"><small>Continue learning</small><strong>' + esc(c.title) + '</strong><span>Unit ' + (i + 1) + ': ' + esc(c.modules[i][0]) + '</span>' + bar(pct(c), c.title + ' progress') + '</span><span class="ac-continue-go" aria-hidden="true">▶</span></a>';
  }

  // --- pages -----------------------------------------------------------------------------
  function home() {
    const started = courses.filter(c => count(c));
    const first = courses[0];
    return '<section class="ac-hero"><div class="wrap ac-hero-grid"><div>' +
      '<span class="eyebrow light">TIME Learning · Online academy</span>' +
      '<h1>Learn practical skills, <em>at your own pace.</em></h1>' +
      '<p class="lead">Eight online courses from TIME Inc. lecturers in school leadership, health care, research and communication. Study on any phone, check your understanding, and keep your progress as you go.</p>' +
      '<div class="btn-row"><a class="btn btn-light" href="#courses">Explore all courses ' + ARROW + '</a><a class="btn btn-outline-light" href="#paths">Learning paths</a></div>' +
      '<ul class="ac-tags"><li>Self-paced</li><li>Free study guides</li><li>Works offline</li><li>Any device</li></ul>' +
      '</div><div class="ac-hero-side">' + (continueCard() || '<div class="ac-preview" aria-hidden="true"><div class="ac-preview-top"><span></span><span></span><span></span><b>Unit 3 of 6</b></div><div class="ac-preview-body" style="--c:' + first.color + '"><small>' + esc(first.code) + ' · ' + esc(first.category) + '</small><strong>' + esc(first.modules[2][0]) + '</strong><i></i><i></i><i class="short"></i><div class="ac-preview-bar"><span></span></div><div class="ac-preview-nav"><em>← Previous</em><em class="go">Next unit →</em></div></div></div>') + '</div></div></section>' +

      '<section class="ac-stats"><div class="wrap"><div><strong>' + courses.length + '</strong><span>online courses</span></div><div><strong>' + courses.length * UNITS + '</strong><span>study units</span></div><div><strong>' + courses.length * UNITS + '</strong><span>practice checks</span></div><div><strong>' + lecturers.length + '</strong><span>lecturers</span></div><div><strong>' + PATHS.length + '</strong><span>learning paths</span></div></div></section>' +

      (started.length ? '<section class="ac-sec"><div class="wrap">' + sectionHead('Your learning', 'Pick up where you left off', '', '<a class="ac-link" href="#my">My learning ' + ARROW + '</a>') + '<div class="ac-grid">' + started.slice(0, 3).map(card).join('') + '</div></div></section>' : '') +

      '<section class="ac-sec"><div class="wrap">' + sectionHead('Subjects', 'Browse by subject', 'Choose a subject to see its courses.') +
      '<div class="ac-cats">' + categories.map(cat => { const n = courses.filter(c => c.category === cat).length; return '<a class="ac-cat" href="#courses/' + encodeURIComponent(cat) + '"><span class="ac-cat-icon">' + icon(cat, 24) + '</span><strong>' + esc(cat) + '</strong><small>' + n + ' course' + (n === 1 ? '' : 's') + '</small></a>'; }).join('') + '</div></div></section>' +

      '<section class="ac-sec ac-tint"><div class="wrap">' + sectionHead('Course library', 'Popular courses', '', '<a class="ac-link" href="#courses">All ' + courses.length + ' courses ' + ARROW + '</a>') +
      '<div class="ac-filter" role="group" aria-label="Show courses"><button type="button" class="on" data-home-filter="" aria-pressed="true">All</button>' + PATHS.map(p => '<button type="button" data-home-filter="' + p.id + '" aria-pressed="false">' + esc(p.title) + '</button>').join('') + '</div>' +
      '<div class="ac-grid" id="home-courses">' + courses.slice(0, 6).map(card).join('') + '</div></div></section>' +

      '<section class="ac-sec"><div class="wrap">' + sectionHead('Learning paths', 'Grow step by step', 'Each path groups related courses. Take them in any order; a course counts towards every path it belongs to.', '<a class="ac-link" href="#paths">All paths ' + ARROW + '</a>') +
      '<div class="ac-paths">' + PATHS.map(pathCard).join('') + '</div></div></section>' +

      '<section class="ac-sec ac-tint"><div class="wrap">' + sectionHead('How it works', 'Learn online. Practise together.', 'About 60% of a program is studied online here; the rest is in-person practice with your lecturer.') +
      '<ol class="ac-steps"><li><b>1</b><h3>Choose a course</h3><p>Browse by subject or follow a learning path.</p></li><li><b>2</b><h3>Study each unit</h3><p>Read the short guide, then try the practical task.</p></li><li><b>3</b><h3>Check your understanding</h3><p>Answer the practice question. Retry as often as you like.</p></li><li><b>4</b><h3>Keep your record</h3><p>Finish all six units to print your learning record.</p></li></ol></div></section>' +

      '<section class="ac-sec"><div class="wrap ac-feature-grid"><div>' + sectionHead('Made for real life', 'Study anywhere, on any connection') +
      '<ul class="ac-features"><li><strong>No app needed.</strong> Open it in any phone or computer browser.</li><li><strong>Saves as you go.</strong> Progress, notes and drafts are kept on your device.</li><li><strong>Works offline.</strong> Pages you have opened stay readable without data.</li><li><strong>Focus mode.</strong> Hide everything except the lesson.</li><li><strong>Larger text.</strong> Make lessons easier to read.</li><li><strong>Take it with you.</strong> Download guides and back up your work.</li></ul></div>' +
      '<div class="ac-record-demo" aria-hidden="true"><div class="ac-record-paper"><img src="assets/img/time-logo-128.png" alt="" width="46" height="46"><small>TIME Learning · Learning record</small><strong>Your name</strong><span>has studied all six units of</span><em>' + esc(first.title) + '</em><div class="ac-record-foot"><span>6 / 6 units</span><span>' + today() + '</span></div></div><p>Print a record for every course you finish. It shows your own study progress; official certificates are issued by TIME Inc. after assessment.</p></div></div></section>' +

      '<section class="ac-sec ac-tint"><div class="wrap">' + sectionHead('Lecturers', 'Learn from TIME Inc. lecturers', 'Qualifications range from master’s to PhD degrees.', '<a class="ac-link" href="team.html#faculty">Leadership &amp; Faculty ' + ARROW + '</a>') +
      '<ul class="ac-lecturers">' + lecturers.map(l => { const cs = courses.filter(c => c.lecturer === l); return '<li><span class="ac-avatar" aria-hidden="true">' + esc(l.replace(/^(Dr|Mr|Mrs|Ms|Rev)\.?\s*/, '').charAt(0)) + '</span><div><strong>' + esc(l) + '</strong>' + cs.map(c => '<a href="' + courseURL(c) + '">' + esc(c.title) + '</a>').join('') + '</div></li>'; }).join('') + '</ul></div></section>' +

      '<section class="ac-sec"><div class="wrap ac-narrow">' + sectionHead('Questions', 'Frequently asked') + faq() + '</div></section>' +

      '<section class="ac-sec"><div class="wrap"><div class="ac-cta"><div><h2>Ready to start?</h2><p>Open your first unit now, or sign in to your account for lecturer assignments, class dates and grades.</p></div><div class="btn-row"><a class="btn btn-light" href="' + lessonURL(first, 0) + '">Start learning ' + ARROW + '</a><a class="btn btn-outline-light" href="account.html">Sign in</a></div></div></div></section>';
  }

  function faq() {
    const qs = [
      ['How do I start?', 'Open any course and press “Start course”. No account is needed to study the guides. To join a class, receive assignments and grades, create a student account in the account workspace.'],
      ['What does a course look like?', 'Each course has six short units. A unit has a summary, three key ideas, a practical task and a practice question, plus space for your notes.'],
      ['Does it cost anything?', 'Studying the online guides is free. Program tuition for TIME Inc. courses is listed on the Fees & Admissions page.'],
      ['Will I receive a certificate?', 'You can print a learning record when you finish a course. It shows your own study progress. Official certificates and diplomas are issued by TIME Inc. after attendance, assessment and payment requirements are met.'],
      ['How does the 60% online / 40% in person format work?', 'You study the units online, then attend in-person sessions with your lecturer for practice and assessment. Your lecturer confirms the dates.'],
      ['Can I use it on a phone or a slow connection?', 'Yes. The academy is text-first and light on data. Pages you have opened stay available offline, and you can download any guide.'],
      ['Where is my progress saved?', 'In this browser on this device. Use Help → Download backup to move it to another device. Shared browsers share the same progress.']
    ];
    return '<div class="ac-faq">' + qs.map(q => '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + (q[0].includes('cost') ? ' <a href="admissions.html#fees">See fees</a>.' : '') + '</p></details>').join('') + '</div>';
  }

  function catalogue(cat) {
    const chips = '<div class="ac-filter" role="group" aria-label="Filter by subject"><button type="button" data-cat="" aria-pressed="' + !cat + '"' + (!cat ? ' class="on"' : '') + '>All subjects</button>' + categories.map(x => '<button type="button" data-cat="' + esc(x) + '" aria-pressed="' + (cat === x) + '"' + (cat === x ? ' class="on"' : '') + '>' + esc(x) + '</button>').join('') + '</div>';
    return pageHero('Course library', 'Choose your next <em>course.</em>', 'Eight courses. Practical ideas. A stronger foundation for your work.') +
      '<section class="ac-sec"><div class="wrap"><div class="ac-toolbar"><label class="sr-only" for="course-search">Search courses, lecturers or units</label><input type="search" id="course-search" placeholder="Search courses, lecturers or units…" autocomplete="off">' +
      '<label class="sr-only" for="course-path">Learning path</label><select id="course-path"><option value="">All learning paths</option>' + PATHS.map(p => '<option value="' + p.id + '">' + esc(p.title) + '</option>').join('') + '</select>' +
      '<label class="sr-only" for="course-sort">Sort</label><select id="course-sort"><option value="">Recommended</option><option value="az">A–Z</option><option value="progress">My progress</option></select></div>' + chips +
      '<p id="search-count" class="ac-count" role="status"></p><div class="ac-grid" id="course-results"></div></div></section>';
  }

  function coursePage(c) {
    const n = count(c), ps = pathsFor(c);
    return '<section class="ac-hero ac-course-hero" style="--c:' + c.color + '"><div class="wrap ac-course-grid"><div>' +
      '<p class="ac-crumbs"><a href="#courses">Courses</a> / ' + esc(c.category) + '</p>' +
      '<span class="eyebrow light">' + esc(c.code) + ' · ' + esc(c.category) + '</span><h1>' + esc(c.title) + '</h1><p class="lead">' + esc(c.intro) + '</p>' +
      '<ul class="ac-tags"><li>' + esc(c.lecturer) + '</li><li>6 units</li><li>6 practice checks</li><li>Self-paced</li></ul>' +
      '<div class="btn-row"><a class="btn btn-light" href="' + lessonURL(c, nextUnit(c)) + '">' + (complete(c) ? 'Review course' : n ? 'Continue unit ' + (nextUnit(c) + 1) : 'Start course') + ' ' + ARROW + '</a>' +
      '<button class="btn btn-outline-light" type="button" data-save="' + c.id + '" aria-pressed="' + !!state.saved[c.id] + '">' + (state.saved[c.id] ? 'Saved ✓' : 'Save course') + '</button></div></div>' +
      '<div class="ac-course-side">' + thumb(c, true) + '<div class="ac-course-progress">' + ring(pct(c), 64) + '<div><strong>' + n + ' of 6 units</strong><span>' + (complete(c) ? 'Course complete' : 'studied in this browser') + '</span></div></div>' +
      (complete(c) ? '<a class="btn btn-light" href="#record/' + c.id + '">Print learning record</a>' : '') + '</div></div></section>' +
      '<section class="ac-sec"><div class="wrap ac-two"><div>' + sectionHead('Course outline', 'Six units', n + ' of 6 studied') +
      '<ol class="ac-outline">' + c.modules.map((m, i) => '<li class="' + (done(c, i) ? 'done' : '') + '"><span class="ac-outline-n">' + (done(c, i) ? '✓' : i + 1) + '</span><div><h3><a href="' + lessonURL(c, i) + '">' + esc(m[0]) + '</a></h3><p>' + esc(m[1]) + '</p></div><a class="ac-outline-go" href="' + lessonURL(c, i) + '" aria-label="Open unit ' + (i + 1) + '">' + ARROW + '</a></li>').join('') + '</ol>' + draftNote + '</div>' +
      '<aside class="ac-aside"><div class="ac-box"><h3>What you’ll learn</h3><ul class="ac-ticks">' + c.modules.map(m => '<li>' + esc(m[0]) + '</li>').join('') + '</ul></div>' +
      '<div class="ac-box"><h3>Your lecturer</h3><p><strong>' + esc(c.lecturer) + '</strong><br><a href="team.html#faculty">Meet the faculty</a></p></div>' +
      (ps.length ? '<div class="ac-box"><h3>Part of</h3>' + ps.map(p => '<a class="ac-path-pill" style="--c:' + p.color + '" href="#paths">' + esc(p.title) + ' path</a>').join('') + '</div>' : '') +
      '<div class="ac-box"><h3>Course tools</h3><a class="ac-tool" href="#assignments/' + c.id + '">Prepare your assignment ' + ARROW + '</a><button class="ac-tool" type="button" id="download-course">Download all six guides ↓</button><a class="ac-tool" href="account.html">Official assignments &amp; grades ' + ARROW + '</a></div></aside></div></section>';
  }

  function lesson(c, i) {
    const m = c.modules[i], id = c.id + ':' + i, n = count(c);
    state.last = id; studied(); save();
    const tries = state.attempts[id] || 0;
    return '<div class="ac-player' + (document.documentElement.classList.contains('ac-focus') ? ' focus' : '') + '" data-size="' + state.textSize + '">' +
      '<div class="ac-player-bar"><div class="wrap"><a class="ac-back" href="' + courseURL(c) + '">← ' + esc(c.code) + ' overview</a><div class="ac-player-progress"><span>Unit ' + (i + 1) + ' of 6 · ' + pct(c) + '% complete</span>' + bar(pct(c), c.title + ' progress') + '</div>' +
      '<div class="ac-player-tools"><button type="button" id="text-size" aria-label="Change text size">A<span aria-hidden="true">±</span></button><button type="button" id="focus-mode" aria-pressed="' + document.documentElement.classList.contains('ac-focus') + '">Focus mode</button></div></div></div>' +
      '<div class="wrap ac-player-grid"><aside class="ac-toc"><h2>' + esc(c.title) + '</h2><p>' + esc(c.lecturer) + '</p><nav aria-label="Course units"><ol>' +
      c.modules.map((x, k) => '<li class="' + (done(c, k) ? 'done ' : '') + (k === i ? 'current' : '') + '"><a href="' + lessonURL(c, k) + '"' + (k === i ? ' aria-current="step"' : '') + '><span>' + (done(c, k) ? '✓' : k + 1) + '</span>' + esc(x[0]) + '</a></li>').join('') + '</ol></nav><p class="ac-toc-foot">' + n + ' of 6 studied</p></aside>' +
      '<article class="ac-lesson"><span class="eyebrow">Unit ' + (i + 1) + ' of 6 · ' + esc(c.category) + '</span><h1>' + esc(m[0]) + '</h1><p class="ac-summary">' + esc(m[1]) + '</p>' +
      '<h2 class="ac-lesson-h">Key ideas</h2><ol class="ac-ideas">' + m.slice(2, 5).map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
      '<div class="ac-task"><h2>Apply what you’ve learned</h2><p>' + esc(m[5]) + '</p><p class="ac-small">Use a fictional or anonymized example. Bring questions to your lecturer.</p></div>' +
      '<section class="ac-quiz" aria-labelledby="check-title"><span class="eyebrow">Practice check · not an official grade</span><h2 id="check-title">Check your understanding</h2><form id="quiz-form"><fieldset><legend>' + esc(m[6]) + '</legend>' +
      m[7].map((a, k) => '<label><input type="radio" name="answer" value="' + k + '" required><span>' + esc(a) + '</span></label>').join('') + '</fieldset><button class="btn btn-primary" type="submit">Check answer</button></form>' +
      '<div id="quiz-feedback" class="ac-feedback" role="status">' + (done(c, i) ? 'You have completed this unit.' : tries ? 'Attempts so far: ' + tries + '. Try again — there’s no limit.' : '') + '</div>' +
      '<button class="btn btn-ghost" id="mark-reviewed" type="button" ' + (done(c, i) ? '' : 'disabled') + '>' + (done(c, i) ? '✓ Unit complete' : 'Mark unit complete') + '</button><p class="ac-small">Answer correctly to complete the unit. This records your own study progress.</p></section>' +
      '<section class="ac-notes"><label for="lesson-notes">Your notes</label><p class="ac-small">Saved on this device only. Don’t write private student or patient information.</p><textarea id="lesson-notes" maxlength="12000" placeholder="What stood out? What will you ask your lecturer?">' + esc(state.notes[id] || '') + '</textarea><span id="notes-status" class="ac-small" role="status"></span></section>' +
      '<div class="ac-lesson-nav">' + (i > 0 ? '<a class="btn btn-ghost" href="' + lessonURL(c, i - 1) + '">← Previous unit</a>' : '<a class="btn btn-ghost" href="' + courseURL(c) + '">← Course overview</a>') +
      '<button class="btn btn-ghost" type="button" id="download-guide">Download guide ↓</button>' +
      (i < 5 ? '<a class="btn btn-primary" href="' + lessonURL(c, i + 1) + '">Next unit →</a>' : complete(c) ? '<a class="btn btn-primary" href="#record/' + c.id + '">Learning record →</a>' : '<a class="btn btn-primary" href="#assignments/' + c.id + '">Prepare assignment →</a>') + '</div>' +
      '<p class="ac-small ac-keys">Tip: use the ← and → keys to move between units.</p>' + draftNote + '</article></div></div>';
  }

  function paths() {
    return pageHero('Learning paths', 'Grow <em>step by step.</em>', 'Each path groups related courses. Take them in any order: a course counts towards every path it belongs to.') +
      '<section class="ac-sec"><div class="wrap"><div class="ac-paths">' + PATHS.map(pathCard).join('') + '</div>' +
      '<ol class="ac-steps ac-steps-sm"><li><b>1</b><h3>Pick a path</h3><p>Choose the one that matches your work.</p></li><li><b>2</b><h3>Study its courses</h3><p>In any order, at your own pace.</p></li><li><b>3</b><h3>Finish the path</h3><p>Print a learning record for the whole path.</p></li></ol></div></section>';
  }

  function my() {
    const started = courses.filter(c => count(c) && !complete(c));
    const finished = courses.filter(complete);
    const saved = courses.filter(c => state.saved[c.id]);
    const correct = total();
    const badges = [
      ['First step', 'Complete your first unit', correct >= 1],
      ['On a roll', 'Study three days in a row', streak() >= 3],
      ['Course finisher', 'Complete a whole course', finished.length >= 1],
      ['Note taker', 'Write notes in five units', Object.values(state.notes).filter(x => x.trim()).length >= 5],
      ['Path finisher', 'Complete a learning path', PATHS.some(p => pathPct(p) === 100)],
      ['Scholar', 'Complete every course', finished.length === courses.length]
    ];
    const list = (arr, empty) => arr.length ? '<div class="ac-grid">' + arr.map(card).join('') + '</div>' : '<p class="ac-empty">' + empty + '</p>';
    return pageHero('My learning', state.name ? 'Welcome back, <em>' + esc(state.name) + '.</em>' : 'Your learning, <em>all in one place.</em>', 'Your progress, saved courses, records and achievements on this device.') +
      '<section class="ac-sec"><div class="wrap"><div class="ac-my-stats"><div>' + ring(Math.round(correct / (courses.length * UNITS) * 100), 76) + '<span>overall</span></div><div><strong>' + correct + '</strong><span>units completed</span></div><div><strong>' + finished.length + '</strong><span>courses finished</span></div><div><strong>' + streak() + '</strong><span>day streak</span></div><div><strong>' + state.days.length + '</strong><span>days studied</span></div></div>' +
      '<form class="ac-name" id="name-form"><label for="learner-name">Name on your learning records</label><div><input id="learner-name" maxlength="80" autocomplete="name" value="' + esc(state.name) + '" placeholder="Your full name"><button class="btn btn-primary" type="submit">Save</button></div></form>' +
      (continueCard() ? '<div class="ac-my-continue">' + continueCard() + '</div>' : '') +
      sectionHead('In progress', 'Keep going') + list(started, 'Courses you start will appear here. <a href="#courses">Browse courses</a>.') +
      sectionHead('Completed', 'Finished courses') + (finished.length ? '<ul class="ac-records">' + finished.map(c => '<li style="--c:' + c.color + '"><span>' + esc(c.title) + '</span><small>' + (state.completedAt[c.id] || '') + '</small><a class="btn btn-ghost" href="#record/' + c.id + '">Learning record</a></li>').join('') + '</ul>' : '<p class="ac-empty">Complete all six units of a course to unlock its learning record.</p>') +
      sectionHead('Saved', 'Saved for later') + list(saved, 'Tap the bookmark on any course to save it here.') +
      sectionHead('Achievements', 'Milestones') + '<ul class="ac-badges">' + badges.map(b => '<li class="' + (b[2] ? 'got' : '') + '"><span aria-hidden="true">' + (b[2] ? '★' : '☆') + '</span><strong>' + b[0] + '</strong><small>' + b[1] + '</small><em class="sr-only">' + (b[2] ? 'Earned' : 'Not yet earned') + '</em></li>').join('') + '</ul>' +
      '</div></section>';
  }

  function record(c, p) {
    const title = c ? c.title : p.title + ' learning path';
    const ok = c ? complete(c) : pathPct(p) === 100;
    const date = c ? (state.completedAt[c.id] || today()) : today();
    if (!ok) return pageHero('Learning record', 'Not finished yet', 'Complete every unit to unlock this record.') + '<section class="ac-sec"><div class="wrap"><a class="btn btn-primary" href="' + (c ? courseURL(c) : '#paths') + '">Back to ' + esc(c ? c.title : 'learning paths') + '</a></div></section>';
    return '<section class="ac-sec ac-record-page"><div class="wrap ac-narrow"><div class="ac-record-actions"><a class="btn btn-ghost" href="' + (c ? courseURL(c) : '#paths') + '">← Back</a><button class="btn btn-primary" type="button" id="print-record">Print or save as PDF</button></div>' +
      (state.name ? '' : '<p class="ac-note">Add your name in <a href="#my">My learning</a> to show it on the record.</p>') +
      '<div class="ac-record"><img src="assets/img/time-logo-128.png" alt="TIME Inc. logo" width="72" height="72"><p class="ac-record-org">TIME Inc. · Technical Institute for Many Empowerment</p><h1>Learning record</h1><p>This records that</p><p class="ac-record-name">' + esc(state.name || 'Learner') + '</p><p>has studied every unit and practice check of</p><p class="ac-record-course">' + esc(title) + '</p>' +
      (c ? '<ul class="ac-record-units">' + c.modules.map(m => '<li>' + esc(m[0]) + '</li>').join('') + '</ul><p>Lecturer: ' + esc(c.lecturer) + '</p>' : '<ul class="ac-record-units">' + pathCourses(p).map(x => '<li>' + esc(x.title) + '</li>').join('') + '</ul>') +
      '<p class="ac-record-date">' + esc(date) + '</p><p class="ac-record-fine">A personal record of online self-study in TIME Learning, kept on the learner’s own device. It is not an official TIME Inc. certificate, transcript or professional authorization. Official certificates are issued by TIME Inc. after attendance, assessment and payment requirements are met.</p></div></div></section>';
  }

  function learningPlan() {
    const weeks = [['Online', 'Orientation + Unit 1', 'Explore the academy and study the first unit in your chosen course.'], ['Online', 'Unit 2 + practice check', 'Read the guide, apply the ideas, and prepare questions.'], ['In person', 'Lecturer-led workshop', 'Proposed practical discussion and guided activities.'], ['Online', 'Unit 3 + independent practice', 'Work through the third study unit.'], ['Online', 'Unit 4 + assignment planning', 'Begin outlining your course assignment.'], ['In person', 'Practical application', 'Proposed supervised activities and lecturer feedback.'], ['Online', 'Unit 5 + revision', 'Review your notes and draft your assignment.'], ['In person', 'Workshop + project feedback', 'Proposed practical demonstration and discussion.'], ['Online', 'Unit 6 + final draft', 'Finish the online units and prepare work for lecturer review.'], ['In person', 'Final review + assessment', 'Proposed formal assessment, subject to TIME requirements.']];
    return pageHero('Blended learning', 'Learn online. <em>Apply in person.</em>', 'A proposed 10-week plan for the 60% online / 40% in-person program.') +
      '<section class="ac-sec"><div class="wrap ac-narrow"><p class="ac-note"><strong>Proposed plan; dates not yet confirmed.</strong> TIME confirms instructional hours, enrolment, assessment, dates, venue and live meeting links. Lecturers publish confirmed dates in the account workspace.</p>' +
      '<ol class="ac-weeks">' + weeks.map((w, i) => '<li class="' + (w[0] === 'Online' ? 'online' : 'campus') + '"><strong>Week ' + (i + 1) + '</strong><div><h3>' + esc(w[1]) + '</h3><p>' + esc(w[2]) + '</p></div><span>' + w[0] + '</span></li>').join('') + '</ol>' +
      '<div class="btn-row"><a class="btn btn-primary" href="account.html">See confirmed class dates ' + ARROW + '</a><a class="btn btn-ghost" href="contact.html">Contact TIME</a></div></div></section>';
  }

  function assignments(c) {
    return pageHero('Assignments', 'Put your ideas <em>into practice.</em>', 'Draft a course reflection or project here, then follow your lecturer’s official instructions to submit it.') +
      '<section class="ac-sec"><div class="wrap ac-two"><div class="ac-box"><label for="assignment-course">Course</label><select id="assignment-course">' + courses.map(x => '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.title) + '</option>').join('') + '</select>' +
      '<div class="ac-task"><h2>Suggested practice task</h2><p>' + esc(c.modules[5][5]) + '</p></div><p class="ac-small">Your lecturer’s approved assignment, deadline and marking criteria take precedence.</p>' +
      '<label for="assignment-draft">Your draft</label><textarea id="assignment-draft" maxlength="30000" class="ac-draft">' + esc(state.drafts[c.id] || '') + '</textarea><div class="ac-draft-meta"><span id="draft-status" class="ac-small" role="status"></span><span id="word-count" class="ac-small"></span></div>' +
      '<div class="btn-row"><button class="btn btn-primary" id="download-assignment" type="button">Download draft (.txt) ↓</button><button class="btn btn-ghost" id="insert-template" type="button">Insert writing outline</button></div></div>' +
      '<aside class="ac-aside"><div class="ac-box"><span class="eyebrow">Before you submit</span><h3>Your draft stays with you.</h3><p class="ac-small">Writing here does not send work to TIME. Submit official assignments through the account workspace or as your lecturer instructs.</p><a class="btn btn-primary" href="account.html">Open account workspace</a><a class="btn btn-ghost" href="mailto:tinstitute312@gmail.com?subject=' + encodeURIComponent('Assignment submission instructions: ' + c.code) + '">Ask TIME for instructions</a></div>' +
      '<div class="ac-box"><h3>Keep a backup</h3><p class="ac-small">Drafts are saved only on this device. <a href="#help">Back up your work</a> before clearing browser data.</p></div></aside></div></section>';
  }

  function help() {
    return pageHero('Help', 'A little guidance <em>goes a long way.</em>', 'Get support, move your work between devices and learn how TIME Learning works.') +
      '<section class="ac-sec"><div class="wrap ac-help"><div class="ac-box"><h2>Contact TIME</h2><p>Ask about enrolment, materials, session dates, lecturer support or official submissions.</p><p><a href="mailto:tinstitute312@gmail.com">tinstitute312@gmail.com</a><br><a href="tel:+231777891104">+231 777 891 104</a></p><div class="btn-row"><a class="btn btn-primary" href="https://wa.me/231888901848?text=' + encodeURIComponent('Hello TIME Inc., I need help with TIME Learning.') + '" target="_blank" rel="noopener">WhatsApp us</a><a class="btn btn-ghost" href="contact.html">Contact page</a></div></div>' +
      '<div class="ac-box"><h2>Backup and restore</h2><p class="ac-small">Download your progress, notes, drafts and saved courses as a file, then restore it on another device. This is not a transcript.</p><div class="btn-row"><button class="btn btn-ghost" id="export-backup" type="button">Download backup</button><button class="btn btn-ghost" id="import-backup" type="button">Restore backup</button><input id="backup-file" type="file" accept=".json,application/json" hidden></div><p id="backup-status" role="status" class="ac-small"></p>' + (!storageAvailable ? '<p class="ac-note"><strong>Storage is blocked in this browser.</strong> Download a backup before leaving.</p>' : '') + '</div>' +
      '<div class="ac-box"><h2>Student &amp; lecturer accounts</h2><p class="ac-small">The account workspace provides verified sign-in, course enrolment, lecturer assignments, private submissions, scores and feedback, attendance, class schedules and announcements.</p><a class="btn btn-primary" href="account.html">Open account workspace</a></div></div>' +
      '<div class="wrap ac-narrow">' + sectionHead('Questions', 'Frequently asked') + faq() + '</div></section>';
  }

  // --- behaviour -------------------------------------------------------------------------
  function bindSave(scope) {
    scope.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-save'); if (!courseIds.has(id)) return;
      if (state.saved[id]) delete state.saved[id]; else state.saved[id] = true;
      save();
      const on = !!state.saved[id];
      document.querySelectorAll('[data-save="' + id + '"]').forEach(x => { x.setAttribute('aria-pressed', on); x.classList.toggle('on', on); if (!x.classList.contains('ac-save')) x.textContent = on ? 'Saved ✓' : 'Save course'; });
      toast(on ? 'Saved to My learning.' : 'Removed from My learning.');
    }));
  }
  function setupCatalogue(cat) {
    const q = document.getElementById('course-search'), path = document.getElementById('course-path'), sort = document.getElementById('course-sort');
    let current = cat || '';
    const run = () => {
      const t = q.value.trim().toLowerCase(), p = PATHS.find(x => x.id === path.value);
      let list = courses.filter(c => (!current || c.category === current) && (!p || p.courses.includes(c.id)) &&
        (!t || (c.title + ' ' + c.lecturer + ' ' + c.category + ' ' + c.code + ' ' + c.modules.map(m => m[0]).join(' ')).toLowerCase().includes(t)));
      if (sort.value === 'az') list = list.slice().sort((a, b) => a.title.localeCompare(b.title));
      if (sort.value === 'progress') list = list.slice().sort((a, b) => pct(b) - pct(a));
      const box = document.getElementById('course-results');
      box.innerHTML = list.length ? list.map(card).join('') : '<p class="ac-empty">No courses match. Try another word or subject.</p>';
      bindSave(box);
      document.getElementById('search-count').textContent = list.length + ' course' + (list.length === 1 ? '' : 's');
    };
    q.addEventListener('input', run); path.addEventListener('change', run); sort.addEventListener('change', run);
    root.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      current = b.getAttribute('data-cat');
      root.querySelectorAll('[data-cat]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      run();
    }));
    run();
  }
  function setupHome() {
    root.querySelectorAll('[data-home-filter]').forEach(b => b.addEventListener('click', () => {
      const p = PATHS.find(x => x.id === b.getAttribute('data-home-filter'));
      root.querySelectorAll('[data-home-filter]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      const box = document.getElementById('home-courses');
      box.innerHTML = (p ? pathCourses(p) : courses.slice(0, 6)).map(card).join('');
      bindSave(box);
    }));
  }
  function setupLesson(c, i) {
    const m = c.modules[i], id = c.id + ':' + i, mark = document.getElementById('mark-reviewed'), fb = document.getElementById('quiz-feedback');
    document.getElementById('quiz-form').addEventListener('submit', e => {
      e.preventDefault();
      const n = Number(new FormData(e.target).get('answer')), pass = n === m[8];
      state.attempts[id] = (state.attempts[id] || 0) + 1; save();
      fb.className = 'ac-feedback ' + (pass ? 'good' : 'retry');
      fb.textContent = pass ? 'Correct! ' + m[7][m[8]] + '. You can now mark this unit complete.' : 'Not quite. Look back at the key ideas and try again (attempt ' + state.attempts[id] + ').';
      if (pass) mark.disabled = false;
    });
    mark.addEventListener('click', () => {
      if (done(c, i)) return;
      state.lessons[id] = true; studied();
      if (complete(c) && !state.completedAt[c.id]) state.completedAt[c.id] = today();
      save();
      mark.textContent = '✓ Unit complete';
      toast(complete(c) ? 'Course complete! Your learning record is ready.' : 'Unit complete. Progress saved.');
      if (complete(c)) setTimeout(() => { location.hash = '#record/' + c.id; }, 900); else setTimeout(render, 600);
    });
    document.getElementById('lesson-notes').addEventListener('input', e => {
      state.notes[id] = e.target.value; const ok = save();
      document.getElementById('notes-status').textContent = ok ? 'Notes saved on this device.' : 'Not saved: download a backup before leaving.';
    });
    document.getElementById('download-guide').addEventListener('click', () => download('TIME-' + c.code + '-Unit-' + (i + 1) + '.txt', 'TIME INC. · TIME LEARNING\nDRAFT STUDY GUIDE (lecturer review pending)\n' + c.title + '\nLecturer: ' + c.lecturer + '\n\n' + guideText(c, i) + '\n\nThis draft guide is not a complete accredited lesson or an official assessment.'));
    document.getElementById('focus-mode').addEventListener('click', e => {
      const on = document.documentElement.classList.toggle('ac-focus');
      e.currentTarget.setAttribute('aria-pressed', on);
      toast(on ? 'Focus mode on. Press Esc to leave.' : 'Focus mode off.');
    });
    document.getElementById('text-size').addEventListener('click', () => {
      state.textSize = (state.textSize + 1) % 3; save();
      root.querySelector('.ac-player').setAttribute('data-size', state.textSize);
      toast(['Normal text', 'Large text', 'Extra-large text'][state.textSize]);
    });
  }
  function setupAssignments(c) {
    document.getElementById('assignment-course').addEventListener('change', e => { location.hash = '#assignments/' + e.target.value; });
    const draft = document.getElementById('assignment-draft'), words = document.getElementById('word-count');
    const wc = () => { const n = (draft.value.match(/\S+/g) || []).length; words.textContent = n + ' word' + (n === 1 ? '' : 's'); };
    wc();
    draft.addEventListener('input', () => { state.drafts[c.id] = draft.value; const ok = save(); wc(); document.getElementById('draft-status').textContent = ok ? 'Draft saved on this device. Not submitted.' : 'Draft not saved: download it before leaving.'; });
    document.getElementById('download-assignment').addEventListener('click', () => {
      if (!draft.value.trim()) { toast('Write your draft or insert the outline first.'); draft.focus(); return; }
      download('TIME-' + c.code + '-assignment-draft.txt', 'TIME INC. · PERSONAL DRAFT (NOT SUBMITTED)\nCourse: ' + c.title + '\nLecturer: ' + c.lecturer + '\n\n' + draft.value);
      toast('Draft downloaded. Follow your lecturer’s instructions to submit.');
    });
    document.getElementById('insert-template').addEventListener('click', () => {
      if (draft.value.trim()) { toast('Your draft already has text, so the outline was not added.'); return; }
      draft.value = '1. Topic or problem\n\n2. Key ideas from the study units\n\n3. Application to a fictional or anonymized example\n\n4. Recommendations and reflection\n\n5. References, if used\n';
      draft.dispatchEvent(new Event('input')); draft.focus();
    });
  }
  function setupHelp() {
    document.getElementById('export-backup').addEventListener('click', () => download('TIME-learning-backup.json', JSON.stringify(state, null, 2), 'application/json'));
    document.getElementById('import-backup').addEventListener('click', () => document.getElementById('backup-file').click());
    document.getElementById('backup-file').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      const status = document.getElementById('backup-status');
      try {
        if (file.size > 2000000) throw new Error('Choose a TIME backup smaller than 2 MB.');
        const imported = sanitize(JSON.parse(await file.text()));
        if (!confirm('Replace the progress, notes and drafts on this device with this backup?')) return;
        state = imported; const ok = save();
        status.textContent = ok ? 'Backup restored on this device.' : 'Restored for this visit, but browser storage is unavailable.';
      } catch (error) { status.textContent = 'Could not restore: ' + error.message; }
      e.target.value = '';
    });
  }

  // --- router ------------------------------------------------------------------------------
  let lastView = '';
  function render() {
    const parts = location.hash.slice(1).split('/').map(decodeURIComponent);
    const view = parts[0] || 'home';
    let c = byId(parts[1]), i = Number(parts[2]), html, title, nav = view;
    if (view !== 'lesson') document.documentElement.classList.remove('ac-focus');
    if (view === 'home') { html = home(); title = 'TIME Learning: Online Courses'; }
    else if (view === 'courses') { html = catalogue(categories.includes(parts[1]) ? parts[1] : ''); title = 'Course library'; }
    else if (view === 'course' && c) { html = coursePage(c); title = c.title; nav = 'courses'; }
    else if (view === 'lesson' && c && /^\d+$/.test(parts[2] || '') && i >= 0 && i < c.modules.length) { html = lesson(c, i); title = c.modules[i][0] + ' · ' + c.code; nav = 'courses'; }
    else if (view === 'paths') { html = paths(); title = 'Learning paths'; }
    else if (view === 'my') { html = my(); title = 'My learning'; }
    else if (view === 'record' && c) { html = record(c); title = 'Learning record · ' + c.title; nav = 'my'; }
    else if (view === 'path-record' && PATHS.some(p => p.id === parts[1])) { html = record(null, PATHS.find(p => p.id === parts[1])); title = 'Learning record'; nav = 'my'; }
    else if (view === 'plan') { html = learningPlan(); title = 'Learning plan'; }
    else if (view === 'assignments') { c = c || courses[0]; html = assignments(c); title = 'Assignments'; }
    else if (view === 'help') { html = help(); title = 'Help'; }
    else { html = pageHero('Page not found', 'Let’s get you back <em>to learning.</em>', 'This course or unit link is not available.') + '<section class="ac-sec"><div class="wrap"><a class="btn btn-primary" href="#courses">Browse courses</a></div></section>'; title = 'Not found'; nav = ''; }
    root.innerHTML = html;
    document.title = title + ' | TIME Learning';
    document.querySelectorAll('[data-nav]').forEach(a => {
      const on = a.getAttribute('data-nav') === nav;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      if (on) { const bar = a.parentElement; if (bar.scrollWidth > bar.clientWidth) bar.scrollLeft = a.offsetLeft - (bar.clientWidth - a.offsetWidth) / 2; }
    });
    bindSave(root);
    if (view === 'home') setupHome();
    if (view === 'courses') setupCatalogue(categories.includes(parts[1]) ? parts[1] : '');
    if (view === 'course' && c) document.getElementById('download-course').addEventListener('click', () => download('TIME-' + c.code + '-study-guides.txt', 'TIME INC. · TIME LEARNING\nDRAFT STUDY GUIDES (lecturer review pending)\n' + c.title + '\nLecturer: ' + c.lecturer + '\n\n' + c.modules.map((_, k) => guideText(c, k)).join('\n\n----------\n\n')));
    if (view === 'lesson' && html.includes('id="quiz-form"')) setupLesson(c, i);
    if (view === 'my') document.getElementById('name-form').addEventListener('submit', e => { e.preventDefault(); state.name = document.getElementById('learner-name').value.trim().slice(0, 80); save(); toast('Name saved.'); render(); });
    if (view === 'record' || view === 'path-record') { const b = document.getElementById('print-record'); if (b) b.addEventListener('click', () => window.print()); }
    if (view === 'assignments') setupAssignments(c);
    if (view === 'help') setupHelp();
    // Move to the top for a new page; keep position when only re-rendering the same view.
    const key = location.hash;
    if (key !== lastView) { window.scrollTo(0, 0); const h = root.querySelector('h1'); if (h && lastView) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    lastView = key;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('ac-focus')) { document.documentElement.classList.remove('ac-focus'); const b = document.getElementById('focus-mode'); if (b) b.setAttribute('aria-pressed', 'false'); }
    if (!/^#lesson\//.test(location.hash) || e.altKey || e.ctrlKey || e.metaKey || /input|textarea|select/i.test((e.target.tagName || ''))) return;
    const [, id, n] = location.hash.slice(1).split('/'); const c = byId(id), i = Number(n);
    if (!c) return;
    if (e.key === 'ArrowRight' && i < UNITS - 1) location.hash = lessonURL(c, i + 1);
    if (e.key === 'ArrowLeft' && i > 0) location.hash = lessonURL(c, i - 1);
  });
  window.addEventListener('hashchange', render);
  render();
})();
