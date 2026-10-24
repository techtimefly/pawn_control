import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {defaults,totals} from '../public/model.mjs';
import {bonusDefaults,upgradeBonusSettings,creditsProgress,nextTipIndex} from '../public/bonus-model.mjs';
import {CreditsTimeline} from '../public/bonus-render.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {Store} from '../lib/store.mjs';
test('legacy settings, presets and backups gain disabled widgets without losing existing state',()=>{
  const original=defaults();original.username='test_player';original.widgets.stats.x=2000;
  const legacy=settingsOf(original);delete legacy.credits;delete legacy.tips;delete legacy.widgets.credits;delete legacy.widgets.tips;
  const upgraded=upgradeBonusSettings(legacy);validateSettings(upgraded);assert.equal(upgraded.widgets.credits.visible,false);assert.equal(upgraded.widgets.tips.visible,false);assert.equal(upgraded.widgets.stats.x,2000);
  const withWin=applyAction(original,{type:'record',result:'win'});
  const restored=applyAction(defaults(),{type:'import',data:{version:1,settings:legacy,session:withWin.session,presets:{Old:legacy}}});
  assert.equal(totals(restored.session).win,1);assert.ok(restored.presets.Old.credits);
  const dir=mkdtempSync(join(tmpdir(),'pawn-bonus-'));const store=new Store(dir);
  try{store.set('state',{...withWin,...legacy,credits:undefined,tips:undefined,widgets:legacy.widgets,presets:{Old:legacy}});const s=store.state();assert.equal(totals(s.session).win,1);assert.ok(s.credits);assert.ok(s.presets.Old.tips);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('credits duration measures full content travel and play-once holds the final frame',()=>{
  const c=bonusDefaults().credits;c.duration=60;
  assert.equal(creditsProgress(0,1440,6000,c).y,1440);
  assert.equal(creditsProgress(30000,1440,6000,c).y,-2280);
  assert.equal(creditsProgress(60000,1440,6000,c).done,true);
  c.loop=true;assert.equal(creditsProgress(60000,1440,6000,c).y,1440);assert.equal(creditsProgress(60000,1440,6000,c).done,false);
  c.timing='speed';c.speed=100;assert.equal(creditsProgress(1000,1440,6000,c).duration,74400);
});
test('credits timeline supports autoplay, pause, resume, restart and hide without affecting another player',()=>{
  const live=new CreditsTimeline(0,true),preview=new CreditsTimeline(0,false);
  assert.equal(live.tick(1000),1000);assert.equal(preview.tick(1000),0);
  preview.command('play',1000);assert.equal(live.tick(2000),2000);assert.equal(preview.tick(2000),1000);
  live.command('pause',2000);assert.equal(live.tick(5000),2000);
  live.command('play',5000);assert.equal(live.tick(6000),3000);
  live.command('restart',6000);assert.equal(live.elapsed,0);assert.equal(live.running,true);
  live.command('stop',7000);assert.equal(live.stopped,true);assert.equal(live.tick(10000),0);
});
test('editing credit content does not emit a live playback command',()=>{
  let s=defaults();const before=structuredClone(s.creditsPlayback);
  s=applyAction(s,{type:'settings',settings:{credits:{...s.credits,brand:'NEW BRAND'}}});assert.deepEqual(s.creditsPlayback,before);
  s=applyAction(s,{type:'credits-playback',command:'restart'});assert.equal(s.creditsPlayback.seq,1);assert.equal(s.creditsPlayback.command,'restart');
  assert.throws(()=>applyAction(s,{type:'credits-playback',command:'invalid'}));
});
test('tip navigation wraps, shuffle avoids immediate repeats, and pause is explicit',()=>{
  assert.equal(nextTipIndex(0,3,-1),2);assert.equal(nextTipIndex(2,3,1),0);assert.equal(nextTipIndex(0,0),0);
  assert.notEqual(nextTipIndex(1,3,1,'shuffle',()=>0),1);
  let s=defaults();s=applyAction(s,{type:'tips-playback',command:'next',currentId:'develop'});assert.equal(s.tipsPlayback.index,2);
  s=applyAction(s,{type:'tips-playback',command:'pause'});assert.equal(s.tipsPlayback.paused,true);
  s=applyAction(s,{type:'tips-playback',command:'play'});assert.equal(s.tipsPlayback.paused,false);
});
test('credits and tips validate lengths, bounds and identifiers',()=>{
  const s=settingsOf(defaults());assert.doesNotThrow(()=>validateSettings(s));
  s.credits.duration=0;assert.throws(()=>validateSettings(s),/credits/);s.credits.duration=60;
  s.tips.items.push({...s.tips.items[0]});assert.throws(()=>validateSettings(s),/tips/);
});
