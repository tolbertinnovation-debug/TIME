import test from 'node:test';import assert from 'node:assert/strict';
import {createLoadingTracker} from '../src/loading-state.mjs';
test('indicator clears after both successful and failed requests',async()=>{
 const states=[],run=createLoadingTracker(v=>states.push(v));assert.equal(await run('Saving',async()=>42),42);assert.deepEqual(states,['Saving',null]);
 await assert.rejects(run('Loading',async()=>{throw Error('Offline');}),/Offline/);assert.equal(states.at(-1),null);
});
test('an earlier request completing cannot hide a later pending request',async()=>{
 const states=[],run=createLoadingTracker(v=>states.push(v));let finishA,finishB;
 const a=run('First',()=>new Promise(r=>finishA=r)),b=run('Second',()=>new Promise(r=>finishB=r));finishA();await a;assert.equal(states.at(-1),'Second');finishB();await b;assert.equal(states.at(-1),null);
});
test('nested authentication returns to the parent request status',async()=>{
 const states=[],run=createLoadingTracker(v=>states.push(v));await run('Loading course',async()=>{await run('Checking account',async()=>{});assert.equal(states.at(-1),'Loading course');});assert.equal(states.at(-1),null);
});
