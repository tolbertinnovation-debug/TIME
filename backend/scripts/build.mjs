import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('build',{recursive:true});
await build({entryPoints:['src/index.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',outfile:'build/index.mjs',external:['pg-native'],banner:{js:'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);'}});
await build({entryPoints:['src/account.mjs'],bundle:true,platform:'browser',target:['es2020'],format:'iife',outfile:'../assets/learning/account.bundle.js',minify:true});
