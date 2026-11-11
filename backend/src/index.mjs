import { Pool } from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { createRemoteJWKSet,jwtVerify } from 'jose';
import { createHandler } from './api.mjs';
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,statement_timeout:15000});attachDatabasePool(pool);
const jwks=createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL));
const issuer=new URL(process.env.NEON_AUTH_BASE_URL).origin;
export default createHandler({query:(sql,values)=>pool.query(sql,values),verify:async token=>{const {payload}=await jwtVerify(token,jwks,{issuer,algorithms:['EdDSA']});if(!payload.sub)throw Error('No subject');return payload.sub;}});
