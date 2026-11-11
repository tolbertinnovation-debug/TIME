/* Neon Auth 0.7 may return cached session data from token().
   Accept only a JWT, never an opaque session cookie or an anonymous token. */
export function extractAccessToken(data) {
 const candidates=[data?.token,data?.session?.token];
 for(const token of candidates)if(typeof token==='string'&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return token;
 return null;
}
export async function getAccessToken(auth,call) {
 const token=extractAccessToken(await call(()=>auth.token()));
 if(token)return token;
 const session=await call(()=>auth.getSession());
 const sessionToken=extractAccessToken(session);
 if(session?.user&&sessionToken)return sessionToken;
 throw Error('Your sign-in session is unavailable. Return to sign-in and try again.');
}
