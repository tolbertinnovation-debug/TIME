import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { portalAccess, portalPage } from '../src/portal-access.mjs';
const source=(await readFile(new URL('../src/account.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
async function render(portal,role,hash=''){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',style:{},focus(){}});return elements.get(id);};
 const requests=[];
 const user={id:'test-user',name:'Test Learner',email:'test@example.invalid',emailVerified:true};
 const context={document:{body:{dataset:{portal}},getElementById:element,querySelector:()=>element('skip'),querySelectorAll:()=>[]},window:{TIME_COURSES:[{id:'school-leadership',code:'SL',title:'School Leadership',lecturer:'Lecturer A'},{id:'research-skills',code:'RS',title:'Research Skills',lecturer:'Lecturer B'}]},location:{hash},portalAccess,portalPage,createAuthClient:()=>({getSession:async()=>({data:role?{user}:null})}),getAccessToken:async()=>'test-jwt',AbortSignal,Intl,Date,setTimeout,clearTimeout,fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.endsWith('/me')?{role,user,teaching:['school-leadership'],enrollments:[]}:url.endsWith('/assignments')?{assignments:[]}:url.endsWith('/sessions')?{sessions:[]}:{submissions:[]}};}};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {html:element('workspace').innerHTML,elements,requests};
}
test('selector provides separate entry points without requesting account data',async()=>{const r=await render();for(const role of ['student','lecturer','admin'])assert.ok(r.html.includes(portalPage(role)));assert.equal(r.requests.length,0);});
test('student and lecturer registration have distinct approval messaging',async()=>{let r=await render('student',null,'#register');assert.match(r.html,/Create student account/);r=await render('lecturer',null,'#register');assert.match(r.html,/Register for approval/);assert.match(r.html,/until TIME approves/);});
test('administrator portal has no public registration even with register hash',async()=>{const r=await render('admin',null,'#register');assert.doesNotMatch(r.html,/id="switch-mode"|id="name"/);assert.match(r.html,/Administrator registration is restricted/);});
for(const portal of ['student','lecturer','admin'])for(const role of ['student','lecturer','admin'])test(`${role} account opening ${portal} portal`,async()=>{const r=await render(portal,role);if(role!==portal){assert.equal(r.requests.length,1);assert.match(r.html,/different workspace|awaiting approval/);assert.ok(r.html.includes('href="'+portalPage(role)+'"'));assert.doesNotMatch(r.html,/id="new-assignment"|id="manage-staff"/);}else{assert.match(r.html,/Welcome, Test Learner/);assert.equal(r.html.includes('id="new-assignment"'),role!=='student');assert.equal(r.html.includes('id="manage-staff"'),role==='admin');if(role==='lecturer'){assert.doesNotMatch(r.html,/Lecturer B/);assert.ok(r.html.indexOf('Teaching workspace')<r.html.indexOf('Course overview'));}}});
test('unknown roles never receive a portal route or access',()=>{assert.equal(portalAccess('admin','owner'),false);assert.equal(portalAccess(null,null),false);assert.equal(portalPage('owner'),'account.html');});
