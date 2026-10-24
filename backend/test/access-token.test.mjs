import test from 'node:test';import assert from 'node:assert/strict';
import {extractAccessToken,getAccessToken} from '../src/access-token.mjs';
const jwt='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl';
const call=async fn=>{const r=await fn();if(r.error)throw Error(r.error.message);return r.data;};
test('normal token response is supported',()=>assert.equal(extractAccessToken({token:jwt}),jwt));
test('SDK cached session response is supported',async()=>{const auth={token:async()=>({data:{user:{id:'test'},session:{token:jwt}}})};assert.equal(await getAccessToken(auth,call),jwt);});
test('opaque session cookies cannot be used as access tokens',()=>assert.equal(extractAccessToken({session:{token:'opaque-cookie'}}),null));
test('getSession fallback requires a user and JWT',async()=>{const auth={token:async()=>({data:{}}),getSession:async()=>({data:{user:{id:'test'},session:{token:jwt}}})};assert.equal(await getAccessToken(auth,call),jwt);auth.getSession=async()=>({data:{session:{token:jwt}}});await assert.rejects(getAccessToken(auth,call),/session is unavailable/);});
test('SDK errors remain errors',async()=>{await assert.rejects(getAccessToken({token:async()=>({error:{message:'Expired'}})},call),/Expired/);});
// Exercise the actual installed SDK: getSession fills its cache, then token()
// may resolve to the cached session shape rather than {token}.
test('installed Neon SDK session-cache regression',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({user:{id:'test',emailVerified:true},session:{token:'opaque-cookie'}},{headers:{'set-auth-jwt':jwt}});
 try{
  const {createAuthClient}=await import('@neondatabase/auth');
  const auth=createAuthClient('https://time-auth-test.example/auth');
  const session=await call(()=>auth.getSession());assert.equal(session.session.token,jwt);
  const cached=await call(()=>auth.token());assert.equal(cached.token,undefined);assert.equal(cached.session.token,jwt);
  assert.equal(await getAccessToken(auth,call),jwt);
 }finally{globalThis.fetch=originalFetch;}
});

test('forced SDK session fetch replaces stale email verification state',async()=>{
 const originalFetch=globalThis.fetch;let verified=false,networkCalls=0;
 globalThis.fetch=async(url,init)=>{
  networkCalls++;
  assert.equal(new Headers(init?.headers).has('X-Force-Fetch'),false,'SDK consumes its cache-bypass header locally');
  if(String(url).includes('/email-otp/verify-email')){verified=true;return Response.json({status:true});}
  return Response.json({user:{id:'verification-user',emailVerified:verified},session:{token:'opaque-cookie'}},{headers:{'set-auth-jwt':jwt}});
 };
 try{
  const {createAuthClient}=await import('@neondatabase/auth');const auth=createAuthClient('https://time-auth-test.example/auth');
  const fresh=()=>call(()=>auth.getSession({query:{disableCookieCache:true},fetchOptions:{headers:{'X-Force-Fetch':'true'}}}));
  assert.equal((await fresh()).user.emailVerified,false);
  await call(()=>auth.emailOtp.verifyEmail({email:'verification@example.invalid',otp:'123456'}));
  assert.equal((await call(()=>auth.getSession())).user.emailVerified,false,'normal getSession can retain the unverified user');
  const before=networkCalls;assert.equal((await fresh()).user.emailVerified,true);assert.equal(networkCalls,before+1);
  assert.equal((await call(()=>auth.getSession())).user.emailVerified,true,'refreshed session is cached');
 }finally{globalThis.fetch=originalFetch;}
});
