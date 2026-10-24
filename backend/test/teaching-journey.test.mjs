import test from 'node:test';import assert from 'node:assert/strict';import {createHandler} from '../src/api.mjs';
// Stateful API integration using synthetic identities and an in-memory query adapter.
// SQL syntax/cohort predicates are also checked separately against development Postgres.
const lecturer='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const ids=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777'];
test('verified lecturer publishes ordered lessons and quiz; approved student completes, resumes and receives a private grade',async()=>{
 const lessons=new Map(),assessments=new Map(),attempts=new Map(),completed=new Set();let next=0;
 const rows=(...items)=>({rows:items});
 const app=createHandler({verify:async token=>token,query:async(sql,v=[])=>{
  if(sql.startsWith('SELECT id, name'))return rows({id:v[0],name:v[0]===lecturer?'Lecturer':'Student',email:'synthetic@example.invalid',emailVerified:true});
  if(sql.startsWith('INSERT INTO time_learning.quotas'))return rows({requests:1});
  if(sql.startsWith('INSERT INTO time_learning.members')||sql.startsWith('INSERT INTO time_learning.audit'))return rows();
  if(sql.startsWith('SELECT user_id, role'))return rows({user_id:v[0],role:v[0]===lecturer?'lecturer':'student',suspended:false});
  if(sql.startsWith('SELECT course_id FROM time_learning.teaching'))return v[0]===lecturer?rows({course_id:'research-skills'}):rows();
  if(sql.startsWith('SELECT id,code,title'))return rows({id:'research-skills',title:'Research Skills',code:'RS',archived:false});
  if(sql.startsWith('SELECT 1 FROM time_learning.enrollments'))return v[0]===student?rows({exists:1}):rows();
  if(sql.startsWith('INSERT INTO time_learning.lessons')){const l={id:ids[next++],course_id:v[0],title:v[1],content:v[2],resources:JSON.parse(v[3]),published:v[4],file_name:null,file_data:null,cohort_id:v[9],week_number:v[10],lesson_order:v[11],require_previous:v[12]};lessons.set(l.id,l);return rows({id:l.id});}
  if(sql.startsWith('SELECT * FROM time_learning.lessons'))return lessons.has(v[0])?rows({...lessons.get(v[0])}):rows();
  if(sql.includes(' AS locked FROM time_learning.lessons')){const l=lessons.get(v[0]);return rows({locked:l.require_previous&&!completed.has(l.id)&&[...lessons.values()].some(p=>p.published&&p.lesson_order<l.lesson_order&&!completed.has(p.id))});}
  if(sql.startsWith('UPDATE time_learning.lessons')){Object.assign(lessons.get(v[0]),{title:v[1],content:v[2],resources:JSON.parse(v[3]),published:v[4],week_number:v[8],lesson_order:v[9],require_previous:v[10]});return rows();}
  if(sql.startsWith('INSERT INTO time_learning.lesson_completions')){assert.equal(v[1],student);completed.add(v[0]);return rows({lesson_id:v[0]});}
  if(sql.startsWith('SELECT completed_at'))return completed.has(v[0])?rows({completed_at:'2026-10-23T12:00:00Z'}):rows();
  if(sql.startsWith('SELECT id FROM time_learning.lessons'))return lessons.has(v[0])?rows({id:v[0]}):rows();
  if(sql.startsWith('INSERT INTO time_learning.assessments')){const a={id:ids[next++],course_id:v[0],cohort_id:v[1],title:v[2],instructions:v[3],kind:v[4],week_number:v[5],questions:JSON.parse(v[6]),pass_mark:v[7],duration_minutes:v[8],max_attempts:v[9],opens_at:v[10],closes_at:v[11],required_lesson_id:v[12],published:v[13]};assessments.set(a.id,a);return rows({id:a.id});}
  if(sql.startsWith('SELECT a.*,now()'))return assessments.has(v[0])?rows({...assessments.get(v[0]),has_attempts:attempts.size>0}):rows();
  if(sql.startsWith('UPDATE time_learning.assessments')){const a=assessments.get(v[0]);Object.assign(a,{title:v[1],instructions:v[2],questions:JSON.parse(v[3]),pass_mark:v[4],duration_minutes:v[5],max_attempts:v[6],opens_at:v[7],closes_at:v[8],required_lesson_id:v[9],week_number:v[10],kind:v[11],published:v[12]});return rows({id:a.id});}
  if(sql.startsWith('SELECT id FROM time_learning.assessment_attempts'))return {rows:[...attempts.values()].filter(x=>x.assessment_id===v[0]&&x.student_id===v[1]&&!x.submitted_at).map(x=>({id:x.id}))};
  if(sql.startsWith('WITH next_number')){const a=assessments.get(v[0]),mine=[...attempts.values()].filter(x=>x.assessment_id===a.id&&x.student_id===v[1]);if(!a.published||v[1]!==student||mine.length>=a.max_attempts||a.required_lesson_id&&!completed.has(a.required_lesson_id))return rows();const x={id:ids[next++],assessment_id:a.id,student_id:v[1],title:a.title,instructions:a.instructions,question_snapshot:structuredClone(a.questions),pass_mark:a.pass_mark,attempt_number:mine.length+1,answers:[],answer_revision:0,server_now:'2026-10-23T12:05:00Z',started_at:'2026-10-23T12:00:00Z',deadline_at:null,submitted_at:null};attempts.set(x.id,x);return rows({id:x.id});}
  if(sql.startsWith('SELECT x.*,a.course_id')){const x=attempts.get(v[0]);return x&&x.student_id===v[1]&&v[1]===student?rows({...x}):rows();}
  if(sql.startsWith('UPDATE time_learning.assessment_attempts SET answers=$2::jsonb,score')){const x=attempts.get(v[0]);if(x.answer_revision!==v[6]||x.submitted_at)return rows();Object.assign(x,{answers:JSON.parse(v[1]),score:v[2],passed:v[3],timed_out:v[4],submitted_at:'2026-10-23T12:06:00Z',answer_revision:x.answer_revision+1});return rows({id:x.id});}
  if(sql.startsWith('UPDATE time_learning.assessment_attempts SET answers=')){const x=attempts.get(v[0]);if(x.answer_revision!==v[3])return rows();x.answers=JSON.parse(v[1]);x.answer_revision++;return rows({answer_revision:x.answer_revision});}
  if(sql.startsWith('SELECT id,attempt_number'))return {rows:[...attempts.values()].filter(x=>x.assessment_id===v[0]&&x.student_id===v[1]).map(({id,attempt_number,score,passed,submitted_at})=>({id,attempt_number,score,passed,submitted_at}))};
  if(sql.startsWith('SELECT x.id,x.student_id'))return {rows:[...attempts.values()].filter(x=>x.assessment_id===v[0]).map(({id,student_id,score,passed,submitted_at})=>({id,student_id,score,passed,submitted_at,name:'Synthetic Student',total:attempts.size}))};
  throw Error('Unimplemented integration query: '+sql.slice(0,100));
 }});
 async function call(who,path,method='GET',data){const response=await app.fetch(new Request('https://test.invalid'+path,{method,headers:{Authorization:'Bearer '+who,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}));return {status:response.status,data:await response.json()};}
 const draft={courseId:'research-skills',title:'First lesson',content:'Study the material.',resources:[],weekNumber:1,lessonOrder:1,requirePrevious:false,published:false};
 let r=await call(lecturer,'/lessons','POST',draft);assert.equal(r.status,201);const first=r.data.lesson.id;
 r=await call(lecturer,'/lessons','POST',{...draft,title:'Second lesson',lessonOrder:2,requirePrevious:true});assert.equal(r.status,201);const second=r.data.lesson.id;
 assert.equal((await call(student,'/lessons/'+first)).status,404);
 for(const [id,order] of [[first,1],[second,2]])assert.equal((await call(lecturer,'/lessons/'+id,'PUT',{...draft,lessonOrder:order,requirePrevious:order===2,published:true})).status,200);
 assert.equal((await call(student,'/lessons/'+second)).status,409);
 assert.equal((await call(student,'/lessons/'+first+'/complete','POST',{})).status,200);
 assert.equal((await call(student,'/lessons/'+second)).status,200);
 const quiz={courseId:'research-skills',title:'Week one check',instructions:'Choose the best answer.',kind:'quiz',weekNumber:1,passMark:60,durationMinutes:0,maxAttempts:1,opensAt:null,closesAt:null,requiredLessonId:second,questions:[{prompt:'Choose A',options:['A','B'],correctIndex:0}],published:false};
 r=await call(lecturer,'/assessments','POST',quiz);assert.equal(r.status,201);const quizId=r.data.assessment.id;
 assert.equal((await call(student,'/assessments/'+quizId)).status,404);
 assert.equal((await call(lecturer,'/assessments/'+quizId,'PUT',{...quiz,published:true})).status,200);
 assert.equal((await call(student,'/assessments/'+quizId+'/start','POST',{})).status,409);
 assert.equal((await call(student,'/lessons/'+second+'/complete','POST',{})).status,200);
 r=await call(student,'/assessments/'+quizId+'/start','POST',{});assert.equal(r.status,201);const attempt=r.data.attempt.id;assert.equal(r.data.attempt.instructions,quiz.instructions);assert(!JSON.stringify(r.data).includes('correctIndex'));
 r=await call(student,'/assessment-attempts/'+attempt+'/answers','PUT',{answers:[0],revision:0});assert.equal(r.status,200);assert.equal(r.data.revision,1);
 r=await call(student,'/assessments/'+quizId+'/start','POST',{});assert.equal(r.status,200);assert.equal(r.data.attempt.id,attempt);assert.deepEqual(r.data.attempt.answers,[0]);
 assert.equal((await call(other,'/assessment-attempts/'+attempt)).status,404);
 r=await call(student,'/assessment-attempts/'+attempt+'/submit','POST',{answers:[0],revision:1,score:0});assert.equal(r.status,200);assert.equal(r.data.attempt.score,100);assert.equal(r.data.attempt.passed,true);assert(!JSON.stringify(r.data).includes('correctIndex'));
 assert.equal((await call(student,'/assessments/'+quizId+'/start','POST',{})).status,409);
 r=await call(student,'/assessments/'+quizId+'/my-results');assert.equal(r.status,200);assert.equal(r.data.attempts[0].score,100);
 r=await call(lecturer,'/assessments/'+quizId+'/results');assert.equal(r.status,200);assert.equal(r.data.results[0].score,100);
 assert.equal((await call(student,'/assessments/'+quizId+'/results')).status,403);
});
