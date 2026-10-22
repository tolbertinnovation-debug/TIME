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
