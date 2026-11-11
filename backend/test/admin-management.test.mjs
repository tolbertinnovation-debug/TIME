import {courseIds} from '../src/policy.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler} from '../src/api.mjs';
const admin='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222';
function harness({role='admin',suspended=false,targetRole='student',targetSuspended=false,verified=true}={}){
 const queries=[];const app=createHandler({verify:async()=>admin,query:async(sql,values=[])=>{queries.push({sql,values});
 if(sql.startsWith('SELECT id,code,title'))return {rows:[...courseIds].map(id=>({id,archived:false}))};
 if(sql.startsWith('SELECT id, name'))return {rows:[{id:admin,emailVerified:true,banned:false}]};
 if(sql.startsWith('INSERT INTO time_learning.quotas'))return {rows:[{requests:1}]};
 if(sql.startsWith('SELECT user_id, role'))return {rows:[{user_id:admin,role,suspended}]};
 if(sql.startsWith('SELECT course_id FROM time_learning.teaching'))return {rows:[]};
 if(sql.startsWith('SELECT id FROM neon_auth'))return {rows:[{id:student}]};
 if(sql.startsWith('SELECT m.role'))return {rows:[{role:targetRole,suspended:targetSuspended,verified,emailVerified:verified,banned:false}]};
 if(sql.startsWith('INSERT INTO time_learning.members(user_id,suspended)'))return {rows:targetRole==='admin'?[]:[{user_id:student}]};
 if(sql.includes('AS pending_enrollments'))return {rows:[{students:4,pending_enrollments:2}]};
 return {rows:[]};}});
 const request=(path,method='GET',body)=>app.fetch(new Request('https://api.example'+path,{method,headers:{Authorization:'Bearer valid','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}));return {request,queries};
}
for(const role of ['student','lecturer'])test(`${role} cannot call any admin management endpoint`,async()=>{const h=harness({role});for(const [path,method,body] of [['/admin/overview','GET'],['/admin/users','GET'],['/admin/enrollments','GET'],['/admin/users/'+student+'/status','PUT',{suspended:true}],['/admin/teaching','PUT',{userId:student,courseId:'research-skills',active:false}],['/admin/enrollments','PUT',{userId:student,courseId:'research-skills',status:'approved',cohort:'Cohort #1'}]])assert.equal((await h.request(path,method,body)).status,403);});
test('suspended accounts are denied on their next API call',async()=>{const h=harness({role:'student',suspended:true});assert.equal((await h.request('/me')).status,403);assert.equal((await h.request('/enroll','POST',{courseId:'research-skills'})).status,403);});
test('admins cannot suspend themselves or another administrator',async()=>{let h=harness();assert.equal((await h.request('/admin/users/'+admin+'/status','PUT',{suspended:true})).status,409);h=harness({targetRole:'admin'});assert.equal((await h.request('/admin/users/'+student+'/status','PUT',{suspended:true})).status,409);});
test('suspension is reversible and audited',async()=>{const h=harness();for(const suspended of [true,false])assert.equal((await h.request('/admin/users/'+student+'/status','PUT',{suspended})).status,200);assert.equal(h.queries.filter(q=>q.sql.includes('INSERT INTO time_learning.audit')).length,2);});
test('overview reads aggregate data and user search remains parameterized',async()=>{const h=harness();const r=await h.request('/admin/overview');assert.equal((await r.json()).overview.pending_enrollments,2);await h.request('/admin/users?search=%27%3Bselect&offset=50');const q=h.queries.find(q=>q.sql.includes('ILIKE'));assert.equal(q.values[0],"';select");assert.equal(q.values[1],50);assert(!q.sql.includes("';select"));});
test('enrolment decisions validate student eligibility and cohort',async()=>{for(const config of [{targetRole:'lecturer'},{targetSuspended:true},{verified:false}]){const h=harness(config);assert.equal((await h.request('/admin/enrollments','PUT',{userId:student,courseId:'research-skills',status:'approved',cohort:'Cohort #1'})).status,400);}const h=harness();assert.equal((await h.request('/admin/enrollments','PUT',{userId:student,courseId:'research-skills',status:'approved',cohort:'Cohort #2'})).status,200);assert.equal((await h.request('/admin/enrollments','PUT',{userId:student,courseId:'research-skills',status:'admin',cohort:'Cohort #2'})).status,400);});
test('new student joins are pending; approved enrolments cannot be downgraded by requesting again',async()=>{const h=harness({role:'student'});assert.equal((await h.request('/enroll','POST',{courseId:'research-skills'})).status,200);const q=h.queries.find(q=>q.sql.startsWith('INSERT INTO time_learning.enrollments'));assert.match(q.sql,/'pending'/);assert.match(q.sql,/WHERE time_learning.enrollments.status='declined'/);});
test('pending enrolments cannot access assignments, meeting details, or submission writes',async()=>{const h=harness({role:'student'});await h.request('/assignments');await h.request('/sessions');assert.equal((await h.request('/assignments/'+student+'/submit','POST',{body:'test'})).status,404);for(const q of h.queries.filter(q=>q.sql.includes('enrollments e')))assert.match(q.sql,/e.status='approved'/);});
test('revoked teaching access uses inactive records and the active filter',async()=>{const h=harness();assert.equal((await h.request('/admin/teaching','PUT',{userId:student,courseId:'research-skills',active:false})).status,200);assert(h.queries.some(q=>q.sql.includes('SET active=false')));assert(h.queries.some(q=>q.sql.includes('teaching WHERE user_id=$1 AND active')));});

test('admins can decline enrollment even after a student account is suspended',async()=>{const h=harness({targetSuspended:true});assert.equal((await h.request('/admin/enrollments','PUT',{userId:student,courseId:'research-skills',status:'declined',cohort:'Cohort #1'})).status,200);});
