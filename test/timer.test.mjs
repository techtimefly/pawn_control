import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,elapsed,totals} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';
test('timer starts, pauses, resumes and restarts without changing scores',t=>{
  t.mock.timers.enable({apis:['Date'],now:100000});
  let s=applyAction(defaults(),{type:'record',result:'win'});
  s=applyAction(s,{type:'timer',command:'start'});t.mock.timers.tick(5000);assert.equal(elapsed(s.session),5000);
  s=applyAction(s,{type:'timer',command:'pause'});t.mock.timers.tick(2000);assert.equal(elapsed(s.session),5000);
  s=applyAction(s,{type:'timer',command:'start'});t.mock.timers.tick(3000);assert.equal(elapsed(s.session),8000);
  const history=structuredClone(s.session.results),baseline=structuredClone(s.session.baseline);
  s=applyAction(s,{type:'timer',command:'restart'});assert.equal(elapsed(s.session),0);assert.notEqual(s.session.runningSince,null);
  assert.equal(totals(s.session).win,1);assert.deepEqual(s.session.results,history);assert.deepEqual(s.session.baseline,baseline);
  t.mock.timers.tick(2000);assert.equal(elapsed(s.session),2000);
});
test('explicit start and pause are idempotent across multiple controls',t=>{
  t.mock.timers.enable({apis:['Date'],now:100000});
  let s=applyAction(defaults(),{type:'timer',command:'start'});t.mock.timers.tick(5000);
  s=applyAction(s,{type:'timer',command:'start'});assert.equal(elapsed(s.session),5000);
  s=applyAction(s,{type:'timer',command:'pause'});s=applyAction(s,{type:'timer',command:'pause'});assert.equal(elapsed(s.session),5000);
  s=applyAction(s,{type:'timer',command:'restart'});assert.equal(elapsed(s.session),0);
  assert.throws(()=>applyAction(s,{type:'timer',command:'invalid'}));
});
