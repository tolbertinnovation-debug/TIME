import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('build',{recursive:true});
await build({entryPoints:['src/index.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'build/index.mjs',external:['pg-native'],banner:{js:'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'}});
// zod -> zod/mini keeps the account page light on phones (see src/zod-browser.mjs).
const zodMini={name:'zod-mini',setup(b){b.onResolve({filter:/^zod$/},(args)=>args.importer.endsWith('zod-browser.mjs')?undefined:{path:new URL('../src/zod-browser.mjs',import.meta.url).pathname});}};
// The default Better Auth adapter shares a file with the unused Supabase adapter; letting esbuild drop
// @supabase/auth-js when nothing references it removes about 80 KB.
const supabaseShakeable={name:'supabase-shakeable',setup(b){b.onResolve({filter:/^@supabase\/auth-js$/},async(args)=>{if(args.pluginData?.skip)return;const r=await b.resolve(args.path,{resolveDir:args.resolveDir,kind:args.kind,pluginData:{skip:true}});return {...r,sideEffects:false};});}};
await build({entryPoints:['src/account.mjs'],bundle:true,platform:'browser',target:['es2020'],format:'iife',outfile:'../assets/learning/account.bundle.js',minify:true,plugins:[zodMini,supabaseShakeable]});
