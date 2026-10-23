import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, totals, streaks, tickerMessages, historyStats } from '../public/model.mjs';
import { applyAction, settingsOf, validateSettings } from '../lib/state.mjs';
test('ordered results, draws, corrections, undo and reset',()=>{
  let s=defaults();
  for(const result of ['win','win','draw','loss','loss'])s=applyAction(s,{type:'record',result});
  assert.deepEqual(totals(s.session),{win:2,loss:2,draw:1});
  assert.deepEqual(streaks(s.session),{current:2,kind:'loss',best:2,label:'2L'});
  s=applyAction(s,{type:'totals',totals:{win:9,loss:2,draw:1}});
  assert.equal(streaks(s.session).label,'2L');
  s=applyAction(s,{type:'decrement',result:'win'});assert.equal(totals(s.session).win,8);
  const previous=structuredClone(s.session);s=applyAction(s,{type:'reset'});assert.deepEqual(totals(s.session),{win:0,loss:0,draw:0});
  s=applyAction(s,{type:'undo'});assert.deepEqual(s.session,previous);
});
test('edits and deletes respect nonnegative totals after manual corrections',()=>{
  let s=defaults();for(let i=0;i<3;i++)s=applyAction(s,{type:'record',result:'win'});
  s=applyAction(s,{type:'totals',totals:{win:0,loss:0,draw:0}});
  s=applyAction(s,{type:'delete-result',id:s.session.results[0].id});
  assert.equal(totals(s.session).win,0);
  s=applyAction(s,{type:'edit-result',id:s.session.results[0].id,result:'loss'});
  assert.equal(totals(s.session).win,0);assert.equal(totals(s.session).loss,1);
});
test('missing ratings skip only affected ticker messages and zero overrides work',()=>{
  let s=defaults();assert.equal(tickerMessages(s).length,3);
  s.overrides.blitz=0;assert.equal(tickerMessages(s).length,4);assert.match(tickerMessages(s)[3],/0 \/ 1500/);
  s.ticker.messages=[{id:'x',text:'<script> {wins} {unknown}',enabled:true}];
  assert.equal(tickerMessages(s)[0],'<script> 0 {unknown}');
});
test('validation rejects off-canvas widgets, duplicate fields, invalid import and prototype presets',()=>{
  const s=defaults();assert.doesNotThrow(()=>validateSettings(settingsOf(s)));
  const invalid=settingsOf(s);invalid.widgets.stats.x=2500;assert.throws(()=>validateSettings(invalid),/fit/);
  assert.throws(()=>applyAction(s,{type:'save-preset',name:'__proto__'}));
  assert.throws(()=>applyAction(s,{type:'settings',settings:{api:{stats:'tampered'}}}),/Unknown setting/);
  assert.throws(()=>applyAction(s,{type:'import',data:{version:1,settings:settingsOf(s),session:{}}}));
  const fields=settingsOf(s);fields.fields[0].id=fields.fields[1].id;assert.throws(()=>validateSettings(fields));
});
test('changing player clears cached identity and rating baselines',()=>{
  const s=defaults();s.api.stats={chess_blitz:{last:{rating:500}}};s.session.baseline.blitz=400;
  const next=applyAction(s,{type:'settings',settings:{username:'another_player'}});
  assert.equal(next.api.stats,null);assert.deepEqual(next.session.baseline,{});
});
test('saved layout presets and backups round trip without replacing scores or credentials',()=>{
  let s=defaults();s=applyAction(s,{type:'save-preset',name:'Gameplay'});
  s=applyAction(s,{type:'record',result:'win'});
  s=applyAction(s,{type:'settings',settings:{showAvatar:true}});
  s=applyAction(s,{type:'load-preset',name:'Gameplay'});assert.equal(s.showAvatar,false);assert.equal(totals(s.session).win,1);
  const restored=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(s),session:s.session,presets:s.presets}});
  assert.deepEqual(totals(restored.session),totals(s.session));assert.ok(restored.presets.Gameplay);assert.equal(restored.api.stats,null);
});
test('historical metrics filter time control, user color and available accuracy',()=>{
  const s=defaults();s.api.games=[
    {time_class:'blitz',rules:'chess',end_time:1,white:{username:s.username,result:'win',rating:400},black:{username:'other',result:'resigned',rating:450},accuracies:{white:80},eco:'https://www.chess.com/openings/Italian-Game'},
    {time_class:'blitz',rules:'chess',end_time:2,white:{username:'other',result:'win',rating:550},black:{username:s.username,result:'checkmated',rating:400}},
    {time_class:'rapid',rules:'chess',end_time:3,white:{username:s.username,result:'win'},black:{username:'other',result:'resigned'}}
  ];const h=historyStats(s);assert.equal(h.form,'50% (2)');assert.equal(h.whiteRate,'100% (1)');assert.equal(h.blackRate,'0% (1)');assert.equal(h.opponent,'500');assert.equal(h.accuracy,'80.0% (1/2)');assert.equal(h.opening,'Italian Game · 1');
});
