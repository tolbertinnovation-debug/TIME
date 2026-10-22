import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { portalAccess, portalPage } from '../src/portal-access.mjs';
const source=(await readFile(new URL('../src/account.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
async function render(portal,role,hash='',verification={}){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',style:{},focus(){}});return elements.get(id);};
 const requests=[];let redirectedTo=null;
 const user={id:'test-user',name:'Test Learner',email:'test@example.invalid',emailVerified:verification.initialVerified!==false};
 const context={document:{body:{dataset:{portal}},getElementById:element,querySelector:()=>element('skip'),querySelectorAll:()=>[]},window:{TIME_COURSES:[{id:'school-leadership',code:'SL',title:'School Leadership',lecturer:'Lecturer A'},{id:'research-skills',code:'RS',title:'Research Skills',lecturer:'Lecturer B'}]},location:{hash,replace:value=>{redirectedTo=value;}},portalAccess,portalPage,FormData:class{get(){return 'test-code';}},createAuthClient:()=>({getSession:async options=>{if(verification.didVerify){assert.equal(options.query.disableCookieCache,true);assert.equal(options.fetchOptions.headers['X-Force-Fetch'],'true');user.emailVerified=true;}return {data:role||verification.created?{user}:null};},signUp:{email:async()=>{verification.created=true;return {data:{user}};}},emailOtp:{sendVerificationOtp:async({email,type})=>{assert.equal(email,user.email);assert.equal(type,'email-verification');verification.requests=(verification.requests||0)+1;if(verification.sendError)return {error:{message:'Email service unavailable'}};return {data:{success:true}};},verifyEmail:async()=>{if(verification.error)return {error:{message:'Invalid verification code'}};verification.didVerify=true;return {data:{status:true}};}}}),getAccessToken:async()=>'test-jwt',AbortSignal,Intl,Date,setTimeout,clearTimeout,fetch:async url=>{requests.push(url);return {ok:true,json:async()=>url.endsWith('/me')?{role,user,teaching:['school-leadership'],enrollments:[]}:url.endsWith('/assignments')?{assignments:[]}:url.endsWith('/sessions')?{sessions:[]}:{submissions:[]}};}};
 vm.runInNewContext(source,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {html:element('workspace').innerHTML,elements,requests,redirectedTo};
}
test('selector provides separate entry points without requesting account data',async()=>{const r=await render();for(const role of ['student','lecturer','admin'])assert.ok(r.html.includes(portalPage(role)));assert.equal(r.requests.length,0);});
test('student and lecturer registration have distinct approval messaging',async()=>{let r=await render('student',null,'#register');assert.match(r.html,/Create student account/);r=await render('lecturer',null,'#register');assert.match(r.html,/Register for approval/);assert.match(r.html,/until TIME approves/);});
test('administrator portal has no public registration even with register hash',async()=>{const r=await render('admin',null,'#register');assert.doesNotMatch(r.html,/id="switch-mode"|id="name"/);assert.match(r.html,/Administrator registration is restricted/);});
for(const portal of ['student','lecturer','admin'])for(const role of ['student','lecturer','admin'])test(`${role} account opening ${portal} portal`,async()=>{const r=await render(portal,role);assert.doesNotMatch(r.html,/portal-links|Student Login|Lecturer Login|Admin Login/);if(role!==portal){assert.equal(r.requests.length,1);assert.match(r.html,/different workspace|awaiting approval/);assert.ok(r.html.includes('href="'+portalPage(role)+'"'));assert.doesNotMatch(r.html,/id="new-assignment"|id="manage-staff"/);}else{assert.match(r.html,/Welcome, Test Learner/);assert.equal(r.html.includes('id="new-assignment"'),role!=='student');assert.equal(r.html.includes('id="manage-staff"'),role==='admin');if(role==='lecturer'){assert.doesNotMatch(r.html,/Lecturer B/);assert.ok(r.html.indexOf('Teaching workspace')<r.html.indexOf('Course overview'));}}});
test('unknown roles never receive a portal route or access',()=>{assert.equal(portalAccess('admin','owner'),false);assert.equal(portalAccess(null,null),false);assert.equal(portalPage('owner'),'account.html');});

for(const error of [false,true])test(error?'invalid code stays on verification form':'verification success is visible until Continue, then lecturer approval is shown',async()=>{
 const state={initialVerified:false,error};const r=await render('lecturer','student','',state);
 assert.match(r.html,/Verify your email to continue/);
 const button={disabled:false};await r.elements.get('verify-form').onsubmit({preventDefault(){},target:{querySelector:()=>button}});
 assert.equal(button.disabled,false);
 const html=()=>r.elements.get('workspace').innerHTML;
 if(error){assert.doesNotMatch(html(),/Email verified successfully/);assert.equal(r.elements.get('account-status').textContent,'Invalid verification code');}
 else{assert.match(html(),/Email verified successfully/);assert.match(html(),/Continue to workspace/);assert.match(html(),/separately approve/);await r.elements.get('continue-verified').onclick();assert.match(html(),/lecturer access is awaiting approval/);}
});

for(const role of ['student','lecturer','admin'])test(`signed-in ${role} opening generic account is sent to own workspace`,async()=>{const r=await render(undefined,role);assert.equal(r.redirectedTo,portalPage(role));assert.doesNotMatch(r.html,/Student Login|Lecturer Login|Admin Login/);});
test('signed-out users still have role choices',async()=>{const r=await render('student',null);assert.match(r.html,/Student Login/);assert.match(r.html,/Lecturer Login/);assert.match(r.html,/Admin Login/);});

for(const portal of ['student','lecturer'])test(`${portal} registration automatically requests one verification code`,async()=>{
 const state={initialVerified:false};const r=await render(portal,null,'#register',state);const button={disabled:false};
 await r.elements.get('auth-form').onsubmit({preventDefault(){},target:{querySelector:()=>button}});
 assert.equal(state.created,true);assert.equal(state.requests,1);assert.equal(button.disabled,false);
 assert.match(r.elements.get('workspace').innerHTML,/Resend code/);assert.match(r.elements.get('account-status').textContent,/Verification code requested/);
 await r.elements.get('send-verification').onclick();assert.equal(state.requests,2);assert.equal(r.elements.get('verification-code').value,'');
});
test('email request failure keeps account and allows resend retry',async()=>{
 const state={initialVerified:false,sendError:true};const r=await render('student',null,'#register',state);
 await r.elements.get('auth-form').onsubmit({preventDefault(){},target:{querySelector:()=>({disabled:false})}});
 assert.equal(state.created,true);assert.equal(state.requests,1);assert.match(r.elements.get('account-status').textContent,/account is created, but/);assert.equal(r.elements.get('send-verification').disabled,false);
 state.sendError=false;await r.elements.get('send-verification').onclick();assert.equal(state.requests,2);assert.match(r.elements.get('account-status').textContent,/Verification code requested/);
});
test('restoring an unverified account does not silently send another code',async()=>{const state={initialVerified:false};const r=await render('student','student','',state);assert.equal(state.requests,undefined);assert.match(r.html,/Resend code/);});
