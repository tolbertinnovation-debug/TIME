(function () {
'use strict';
const courses = window.TIME_COURSES;
const KEY = 'time-learning-v1';
const main = document.getElementById('main');
let storageAvailable = true;
let state = { version: 1, lessons: {}, notes: {}, drafts: {}, last: null };
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ids = new Set(courses.flatMap(c => c.modules.map((_, i) => c.id + ':' + i)));
function sanitize(raw) {
  if (!raw || raw.version !== 1 || typeof raw !== 'object') throw new Error('Unrecognized backup format.');
  const clean = {version:1,lessons:{},notes:{},drafts:{},last:null};
  for (const id of ids) {
    if (raw.lessons && raw.lessons[id] === true) clean.lessons[id] = true;
    if (raw.notes && typeof raw.notes[id] === 'string') clean.notes[id] = raw.notes[id].slice(0,12000);
  }
  for (const c of courses) if (raw.drafts && typeof raw.drafts[c.id] === 'string') clean.drafts[c.id] = raw.drafts[c.id].slice(0,30000);
  if (typeof raw.last === 'string' && ids.has(raw.last)) clean.last = raw.last;
  return clean;
}
try { const raw = localStorage.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); localStorage.setItem(KEY, JSON.stringify(state)); }
catch (_) { storageAvailable = false; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (_) { storageAvailable = false; toast('Browser storage is unavailable. Download a backup before leaving.'); return false; }
}
function toast(message) {
  const el = document.getElementById('toast'); el.textContent = message; el.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.style.display = 'none'; }, 4500);
}
function count(c) { return c.modules.filter((_, i) => state.lessons[c.id + ':' + i]).length; }
function total() { return courses.reduce((n, c) => n + count(c), 0); }
function next(c) { const i = c.modules.findIndex((_, i) => !state.lessons[c.id + ':' + i]); return i < 0 ? 0 : i; }
function courseURL(c) { return '#course/' + c.id; }
function lessonURL(c, i) { return '#lesson/' + c.id + '/' + i; }
function notice() {
  return '<div class="notice"><strong>Early access learning portal.</strong> These draft study guides and practice checks await lecturer review. Progress and drafts are saved only in this browser, not in a student account. Official submissions, grades, live sessions, and certificates are not available here yet.' + (!storageAvailable ? '<p><strong>Storage is blocked:</strong> work will be lost when this page closes unless you download a backup.</p>' : '') + '</div>';
}
function heading(label,title,description) { return '<div class="eyebrow">'+esc(label)+'</div><div class="page-heading"><div><h1>'+esc(title)+'</h1><p class="muted">'+esc(description)+'</p></div><span class="pill">COHORT #1</span></div>'; }
function card(c) {
  const n = count(c), percent = Math.round(n / 6 * 100);
  return '<article class="course-card" style="--course-color:'+c.color+'"><div class="course-top"><span class="course-code">'+c.code+'</span><span class="category">'+esc(c.category)+'</span></div><div class="course-body"><h3>'+esc(c.title)+'</h3><p>'+esc(c.lecturer)+' · 6 online units</p><div class="progress-label"><span>'+n+' of 6 units reviewed</span><span>'+percent+'%</span></div><div class="progress" role="progressbar" aria-label="'+esc(c.title)+' study progress" aria-valuenow="'+percent+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+percent+'%"></span></div><a class="btn secondary" href="'+courseURL(c)+'">'+(n ? 'Continue course' : 'Explore course')+' <span aria-hidden="true">→</span></a></div></article>';
}
function dashboard() {
  const last = state.last && state.last.split(':');
  const c = (last && courses.find(c => c.id === last[0])) || courses[0];
  const i = last ? Number(last[1]) : next(c);
  return heading('Welcome to TIME Learning','A new chapter starts here.','Build knowledge online. Develop practical skills together.')+
  '<section class="hero-panel" aria-labelledby="continue-title"><div><div class="eyebrow">YOUR NEXT STEP</div><h2 id="continue-title">'+(total() ? 'Keep your learning moving.' : 'Make time for your next opportunity.')+'</h2><p>'+esc(c.title)+'<br>Unit '+(i+1)+': '+esc(c.modules[i][0])+'</p><a class="btn light" href="'+lessonURL(c,i)+'">'+(state.last ? 'Continue studying' : 'Start your first unit')+' <span aria-hidden="true">→</span></a></div><div class="hero-side"><strong>60<span style="font-size:1.4rem">%</span></strong><small>Learn online, at your pace.<br>40% in-person practice.</small></div></section>'+
  '<div class="stats"><div class="stat"><strong>08</strong><span>Courses to explore</span></div><div class="stat"><strong>'+total()+'<span style="display:inline;font-size:1rem"> / 48</span></strong><span>Study units reviewed</span></div><div class="stat"><strong>10</strong><span>Week proposed plan</span></div></div>'+
  '<div class="section-heading"><h2>Your courses</h2><a href="#courses">View all courses →</a></div><div class="course-grid">'+courses.slice(0,4).map(card).join('')+'</div>'+notice()+
  '<section class="panel session-card"><div><div class="eyebrow">LEARN TOGETHER</div><h3>Online discussion. In-person practice.</h3><p class="muted small">Session dates and meeting links will be announced by TIME. No live class is scheduled in this portal yet.</p></div><a class="btn secondary" href="#plan">Explore the plan</a></section>';
}
function catalogue() {
  return heading('Course library','Choose your next course.','Eight courses. Practical ideas. A stronger foundation for your work.')+
  '<div class="search-row"><label class="sr-only" for="course-search">Search courses or lecturers</label><input type="search" id="course-search" placeholder="Search courses or lecturers…"><label class="sr-only" for="category">Filter by subject</label><select id="category"><option value="">All subjects</option>'+[...new Set(courses.map(c=>c.category))].map(x=>'<option>'+esc(x)+'</option>').join('')+'</select></div><p id="search-count" class="small muted" role="status">8 courses</p><div class="course-grid" id="course-results">'+courses.map(card).join('')+'</div>';
}
function coursePage(c) {
  return '<div class="crumb"><a href="#courses">Course library</a> / '+esc(c.code)+'</div>'+heading(c.category,c.title,c.lecturer+' · Six online study units')+
  '<p class="course-intro">'+esc(c.intro)+'</p><div class="btn-row"><a class="btn" href="'+lessonURL(c,next(c))+'">'+(count(c) ? 'Continue studying' : 'Start course')+' →</a><a class="btn secondary" href="#assignments/'+c.id+'">Prepare course assignment</a></div>'+notice()+
  '<div class="section-heading"><h2>Online study units</h2><span class="small muted">'+count(c)+' / 6 reviewed</span></div><div class="modules">'+c.modules.map((m,i)=>'<article class="module"><span class="module-number">'+(state.lessons[c.id+':'+i]?'✓':String(i+1).padStart(2,'0'))+'</span><div class="module-content"><h3>'+esc(m[0])+'</h3><p>'+esc(m[1])+'</p><span class="status">'+(state.lessons[c.id+':'+i]?'Reviewed in this browser':'Draft guide · lecturer review pending')+'</span></div><a class="btn secondary" href="'+lessonURL(c,i)+'">Open unit →</a></article>').join('')+'</div>';
}
function lesson(c,i) {
  const m = c.modules[i], id = c.id+':'+i;
  state.last = id; save();
  return '<div class="crumb"><a href="'+courseURL(c)+'">'+esc(c.code)+' course overview</a> / Unit '+(i+1)+'</div>'+heading('UNIT '+(i+1)+' OF 6',m[0],c.lecturer+' · Draft self-study guide')+
  '<div class="lesson-layout"><div><article class="panel"><p class="lesson-summary">'+esc(m[1])+'</p><div class="eyebrow">IDEAS TO UNDERSTAND</div><ol class="reading-list">'+m.slice(2,5).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol><div class="callout"><h3>Apply what you have learned</h3><p>'+esc(m[5])+'</p></div><p class="small muted">Use a fictional or anonymized example. Bring questions to your lecturer. This draft guide is a starting point, not a complete accredited lesson or an official assessment.</p><button class="btn secondary" id="download-guide" type="button">Download study guide ↓</button></article>'+
  '<section class="panel quiz" aria-labelledby="check-title"><div class="eyebrow">PRACTICE CHECK · NOT AN OFFICIAL GRADE</div><h2 id="check-title">Check your understanding</h2><form id="quiz-form"><fieldset><legend>'+esc(m[6])+'</legend>'+m[7].map((answer,n)=>'<label><input type="radio" name="answer" value="'+n+'" required><span>'+esc(answer)+'</span></label>').join('')+'</fieldset><button class="btn" type="submit">Check answer</button></form><div id="quiz-feedback" class="feedback" role="status"></div><button class="btn secondary" id="mark-reviewed" type="button" '+(!state.lessons[id]?'disabled':'')+'>'+(state.lessons[id]?'✓ Unit reviewed':'Mark unit as reviewed')+'</button><p class="small muted" style="margin-top:12px">Answer the practice question correctly to enable the review button. This records personal study progress only.</p></section>'+
  '<section class="panel"><label for="lesson-notes">Your study notes</label><p class="small muted">Saved on this browser only. Do not enter private student or patient information.</p><textarea id="lesson-notes" maxlength="12000" placeholder="What stood out? What will you ask your lecturer?">'+esc(state.notes[id]||'')+'</textarea><span id="notes-status" class="small muted" role="status"></span></section>'+
  '<div class="btn-row lesson-navigation">'+(i>0?'<a class="btn secondary" href="'+lessonURL(c,i-1)+'">← Previous unit</a>':'<a class="btn secondary" href="'+courseURL(c)+'">← Course overview</a>')+(i<5?'<a class="btn" href="'+lessonURL(c,i+1)+'">Next unit →</a>':'<a class="btn" href="#assignments/'+c.id+'">Prepare assignment →</a>')+'</div></div>'+
  '<aside class="lesson-aside"><div class="panel"><h3>Course outline</h3><nav aria-label="Course units">'+c.modules.map((x,n)=>'<a class="'+(i===n?'current':'')+'" '+(i===n?'aria-current="step"':'')+' href="'+lessonURL(c,n)+'">'+(state.lessons[c.id+':'+n]?'✓ ':String(n+1)+'. ')+esc(x[0])+'</a>').join('')+'</nav></div><p class="small muted">Need support? <a href="#help">Find help</a>.</p></aside></div>';
}
function learningPlan() {
  const weeks=[['Online','Orientation + Unit 1','Explore the portal and study the first unit in your chosen course.'],['Online','Unit 2 + practice check','Read the guide, apply the ideas, and prepare questions.'],['In person','Lecturer-led workshop','Proposed practical discussion and guided activities.'],['Online','Unit 3 + independent practice','Work through the third study unit.'],['Online','Unit 4 + assignment planning','Begin outlining your course assignment.'],['In person','Practical application','Proposed supervised activities and lecturer feedback.'],['Online','Unit 5 + revision','Review your notes and draft your assignment.'],['In person','Workshop + project feedback','Proposed practical demonstration and discussion.'],['Online','Unit 6 + final draft','Finish the online guides and prepare work for lecturer review.'],['In person','Final review + assessment','Proposed formal assessment, subject to TIME requirements.']];
  return heading('Blended learning','Learn online. Apply in person.','A proposed 10-week structure for the 60% online / 40% in-person program.')+
  '<div class="notice"><strong>Proposed plan — dates not yet confirmed.</strong> Six online weeks and four in-person weeks illustrate the intended split. TIME must confirm instructional hours, enrolment, assessment arrangements, dates, venue, and live meeting links. Week allocations alone do not establish the final 60/40 instructional-hour split.</div>'+
  '<div class="week-list">'+weeks.map((w,i)=>'<article class="week"><strong>Week<br>'+String(i+1).padStart(2,'0')+'</strong><div><h3>'+esc(w[1])+'</h3><p>'+esc(w[2])+'</p></div><span class="pill '+(w[0]==='Online'?'online':'campus')+'">'+w[0]+'</span></article>').join('')+'</div>'+
  '<section class="panel" style="margin-top:24px"><h2>Live classes and campus sessions</h2><p>No meeting link, start date, or confirmed timetable has been supplied yet. Please contact TIME for enrolment and official class arrangements.</p><a class="btn" href="contact.html">Contact TIME →</a></section>';
}
function assignments(selected) {
  const c = courses.find(x=>x.id===selected)||courses[0];
  return heading('Your workspace','Put your ideas into practice.','Prepare a course reflection or project draft, then follow your lecturer’s official instructions.')+
  '<div class="assignment-grid"><section class="panel"><label for="assignment-course">Select course</label><select id="assignment-course" style="width:100%">'+courses.map(x=>'<option value="'+x.id+'" '+(x.id===c.id?'selected':'')+'>'+esc(x.title)+'</option>').join('')+'</select><div class="callout"><h3>Suggested practice task</h3><p>'+esc(c.modules[5][5])+'</p></div><p class="small muted">This is a draft practice task; the lecturer’s approved assignment, deadline, and marking criteria take precedence.</p><label for="assignment-draft">Your draft</label><textarea id="assignment-draft" maxlength="30000" style="min-height:350px">'+esc(state.drafts[c.id]||'')+'</textarea><span id="draft-status" class="small muted" role="status"></span><div class="btn-row" style="margin-top:15px"><button class="btn" id="download-assignment" type="button">Download draft (.txt) ↓</button><button class="btn secondary" id="insert-template" type="button">Insert writing outline</button></div></section>'+
  '<aside><section class="panel"><div class="eyebrow">BEFORE YOU SUBMIT</div><h3>Your draft stays with you.</h3><p class="small">Writing here does not submit work to TIME. Download the file and use the submission channel confirmed by your lecturer.</p><p class="small">No deadline or submission channel has been confirmed in the portal.</p><a class="btn secondary" href="mailto:tinstitute312@gmail.com?subject='+encodeURIComponent('Cohort 1 assignment submission instructions: '+c.code)+'">Ask TIME for instructions</a></section><section class="panel"><h3>Keep a backup</h3><p class="small muted">Drafts are stored only in this browser. Download them before clearing browser data or moving to another device.</p><a href="#help" class="small">Backup and restore →</a></section></aside></div>';
}
function help() {
  return heading('Here to help','A little guidance goes a long way.','Understand this first release and keep your learning work safe.')+
  '<div class="help-grid"><section class="panel"><h2>Contact TIME</h2><p>Ask about enrolment, teaching materials, session dates, lecturer support, or official submissions.</p><p><a href="mailto:tinstitute312@gmail.com">tinstitute312@gmail.com</a><br><a href="tel:+231777891104">+231 777 891 104</a></p><a class="btn" href="contact.html">Contact details →</a></section><section class="panel"><h2>Your learning backup</h2><p class="small">Export notes, reviewed-unit progress, and assignment drafts to a JSON file. Import it on another browser to restore your work. This is not a student transcript.</p><div class="export-actions"><button class="btn secondary" id="export-backup" type="button">Download backup</button><button class="btn secondary" id="import-backup" type="button">Restore backup</button><input id="backup-file" type="file" accept=".json,application/json" hidden></div><p id="backup-status" role="status" class="small"></p></section></div>'+
  '<section class="panel" style="margin-top:22px"><h2>What is available now?</h2><details open><summary>Study guides, quizzes, notes, and drafts</summary><p>Eight course spaces contain 48 draft study guides and 48 practice questions. You can track personal review progress, take notes, download guides, and prepare assignment drafts. TIME’s lecturers must review and expand the guides before formal teaching use.</p></details><details><summary>Student accounts and private submissions</summary><p>Accounts, secure enrolment, private file uploads, cross-device synchronization, official attendance, lecturer grading, and certificates are not connected in this release. Do not use this public portal to store confidential information.</p></details><details><summary>Lecturers and qualifications</summary><p>Lecturers’ qualifications range from master’s to PhD degrees, as provided by TIME. Individual academic profiles and photos will be added when supplied and approved.</p></details><details><summary>How does the 60% online / 40% in-person format work?</summary><p>The learning plan proposes six online weeks and four in-person weeks. TIME must confirm actual contact hours, dates, and assessment requirements. Online practice progress does not replace in-person attendance.</p></details><details><summary>Will I receive a certificate here?</summary><p>This release does not issue certificates or verify completion. Only TIME can confirm registration, attendance, assessed achievement, and eligibility for an official certificate.</p></details><details><summary>Can I use the portal on a phone or a slow connection?</summary><p>The portal is text-first and does not autoplay video. Download individual guides for later reading. You still need an internet connection to first open a page; full offline app support is not included.</p></details><details><summary>What if my browser blocks storage?</summary><p>You can still study and use practice checks, but work may not persist. Export a backup before leaving. Shared browser profiles share the same local learning workspace.</p></details></section>';
}
function download(name,text,type) {
  const url=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function setup(c,i,view) {
  if(view==='courses') {
    const filter=()=>{const q=document.getElementById('course-search').value.trim().toLowerCase(),cat=document.getElementById('category').value;const matches=courses.filter(c=>(!cat||c.category===cat)&&(c.title+' '+c.lecturer+' '+c.category).toLowerCase().includes(q));document.getElementById('course-results').innerHTML=matches.length?matches.map(card).join(''):'<p class="empty">No matching courses. Try another search or subject.</p>';document.getElementById('search-count').textContent=matches.length+' course'+(matches.length===1?'':'s');};
    document.getElementById('course-search').addEventListener('input',filter);document.getElementById('category').addEventListener('change',filter);
  }
  if(view==='lesson') {
    const m=c.modules[i],id=c.id+':'+i,mark=document.getElementById('mark-reviewed');
    document.getElementById('quiz-form').addEventListener('submit',e=>{e.preventDefault();const n=Number(new FormData(e.target).get('answer')),pass=n===m[8];const fb=document.getElementById('quiz-feedback');fb.className='feedback '+(pass?'good':'retry');fb.textContent=pass?'Correct. '+m[7][m[8]]+'. You can now mark this unit as reviewed.':'Not quite. Review the guide and try again. Look for the option that matches the unit’s main principle.';if(pass)mark.disabled=false;});
    mark.addEventListener('click',()=>{state.lessons[id]=true;save();mark.textContent='✓ Unit reviewed';toast('Study progress updated in this browser.');});
    document.getElementById('lesson-notes').addEventListener('input',e=>{state.notes[id]=e.target.value;const ok=save();document.getElementById('notes-status').textContent=ok?'Notes saved in this browser.':'Not saved — download a backup before leaving.';});
    document.getElementById('download-guide').addEventListener('click',()=>download('TIME-'+c.code+'-Unit-'+(i+1)+'.txt','TIME INC. — COHORT #1\nDRAFT STUDY GUIDE — LECTURER REVIEW PENDING\n'+c.title+'\nLecturer: '+c.lecturer+'\n\nUNIT '+(i+1)+': '+m[0]+'\n\n'+m[1]+'\n\n'+m.slice(2,5).map((x,n)=>(n+1)+'. '+x).join('\n\n')+'\n\nPRACTICE TASK\n'+m[5]+'\n\nYOUR NOTES\n'+(state.notes[id]||'')+'\n\nThis draft guide is not a complete accredited lesson, official assessment, or professional authorization. Follow your lecturer’s approved materials.'));
  }
  if(view==='assignments') {
    document.getElementById('assignment-course').addEventListener('change',e=>{location.hash='#assignments/'+e.target.value;});
    const draft=document.getElementById('assignment-draft');
    draft.addEventListener('input',()=>{state.drafts[c.id]=draft.value;const ok=save();document.getElementById('draft-status').textContent=ok?'Draft saved in this browser. Not submitted.':'Draft not saved — download it before leaving.';});
    document.getElementById('download-assignment').addEventListener('click',()=>{if(!draft.value.trim()){toast('Write your draft or insert the outline first.');draft.focus();return;}download('TIME-'+c.code+'-assignment-draft.txt','TIME INC. — COHORT #1\nPERSONAL DRAFT — NOT SUBMITTED\nCourse: '+c.title+'\nLecturer: '+c.lecturer+'\n\n'+draft.value);toast('Draft downloaded. Follow your lecturer’s instructions to submit.');});
    document.getElementById('insert-template').addEventListener('click',()=>{if(draft.value.trim()){toast('Your draft already contains text. The outline will not replace it.');return;}draft.value='1. Topic or problem\n\n2. Key ideas from the study units\n\n3. Application to a fictional or anonymized example\n\n4. Recommendations and reflection\n\n5. References, if used\n';draft.dispatchEvent(new Event('input'));draft.focus();});
  }
  if(view==='help') {
    document.getElementById('export-backup').addEventListener('click',()=>download('TIME-learning-backup.json',JSON.stringify(state,null,2),'application/json'));
    document.getElementById('import-backup').addEventListener('click',()=>document.getElementById('backup-file').click());
    document.getElementById('backup-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const status=document.getElementById('backup-status');try{if(file.size>2000000)throw new Error('Choose a TIME backup smaller than 2 MB.');const imported=sanitize(JSON.parse(await file.text()));if(!confirm('Replace progress, notes, and drafts in this browser with this backup? Download your current backup first if needed.'))return;state=imported;const ok=save();status.textContent=ok?'Backup restored in this browser.':'Restored for this session, but browser storage is unavailable.';}catch(error){status.textContent='Could not restore: '+error.message;}e.target.value='';});
  }
}
function render() {
  const parts=location.hash.slice(1).split('/'),view=parts[0]||'dashboard';
  let c=courses.find(x=>x.id===parts[1]),i=Number(parts[2]),html;
  if(view==='dashboard')html=dashboard();
  else if(view==='courses')html=catalogue();
  else if(view==='course'&&c)html=coursePage(c);
  else if(view==='lesson'&&c&&/^\d+$/.test(parts[2]||'')&&i>=0&&i<c.modules.length)html=lesson(c,i);
  else if(view==='plan')html=learningPlan();
  else if(view==='assignments'){c=c||courses[0];html=assignments(c.id);}
  else if(view==='help')html=help();
  else html=heading('Page not found','Let’s get you back to learning.','This course or unit link is not available.')+'<a class="btn" href="#courses">Browse courses</a>';
  main.innerHTML=html;
  document.querySelectorAll('[data-nav]').forEach(a=>{const selected=a.dataset.nav===((view==='course'||view==='lesson')?'courses':view);a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  document.title=(c&&(view==='course'||view==='lesson')?c.title:view==='dashboard'?'Your learning overview':view==='courses'?'Course library':view==='plan'?'Learning plan':view==='assignments'?'Assignments':'Learning support')+' | TIME Learning';
  if(html.includes('id="quiz-form"')||['courses','assignments','help'].includes(view))setup(c,i,view);
  window.scrollTo(0,0);main.focus({preventScroll:true});
}
document.getElementById('year').textContent=new Date().getFullYear();
document.querySelector('.skip').addEventListener('click', e => { e.preventDefault(); main.focus(); main.scrollIntoView(); });
window.addEventListener('hashchange',render);render();
})();
