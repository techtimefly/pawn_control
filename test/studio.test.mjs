import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaults} from '../public/model.mjs';
import {applyAction,validateSettings} from '../lib/state.mjs';
import {migrateStudio,editorState,editStudio,studioAction,exportTemplate} from '../lib/studio.mjs';
import {Store} from '../lib/store.mjs';
import {createApp} from '../server.mjs';

test('migration preserves old settings, presets, session, undo and published output',()=>{
  let old=defaults();old.username='old_player';old=applyAction(old,{type:'record',result:'win'});old=applyAction(old,{type:'save-preset',name:'Old layout'});
  delete old.info;delete old.rss;delete old.counters;for(const k of ['info','rss','counters'])delete old.widgets[k];
  const studio=migrateStudio(old);assert.deepEqual(studio.published.state.session,old.session);assert.deepEqual(editorState(studio).presets,old.presets);assert.deepEqual(editorState(studio).undo,old.undo);assert.equal(editorState(studio).widgets.rss.visible,false);assert.equal(old.rss,undefined);
});
test('draft structural changes and profile browsing never publish; live controls target published show',()=>{
  let s=migrateStudio(defaults()),original=structuredClone(s.published),first=structuredClone(s.selected);
  s=editStudio(s,{type:'settings',settings:{channel:'draft_handle'}});assert.deepEqual(s.published,original);
  s=studioAction(s,{type:'create-profile',name:'Generic'});assert.equal(editorState(s).username,'');validateSettings(editorStateSettings(s));
  s=editStudio(s,{type:'record',result:'win'});assert.equal(s.published.state.session.results.length,1);assert.equal(editorState(s).session.results.length,0);
  s=studioAction(s,{type:'take-live'});assert.equal(s.published.state.username,'');s=editStudio(s,{type:'counter-live',id:'count',delta:1});assert.equal(s.published.state.counters[0].value,1);
  s=studioAction(s,{type:'select',...first});assert.equal(editorState(s).channel,'draft_handle');assert.equal(editorState(s).session.results.length,1);assert.equal(s.published.state.counters[0].value,1);
});
import {settingsOf} from '../lib/state.mjs';
const editorStateSettings=s=>settingsOf(editorState(s));
test('named shows isolate layouts/content/session and share brand identity',()=>{
  let s=migrateStudio(defaults()),first=structuredClone(s.selected);
  s=editStudio(s,{type:'settings',settings:{channel:'brand_handle',info:{title:'First show',text:'Content'}}});
  s=studioAction(s,{type:'duplicate-show',name:'Second'});s=editStudio(s,{type:'settings',settings:{info:{title:'Second show',text:'Other'},channel:'new_handle'}});
  s=studioAction(s,{type:'select',...first});assert.equal(editorState(s).info.title,'First show');assert.equal(editorState(s).channel,'new_handle');
  s=studioAction(s,{type:'duplicate-profile',name:'Copy'});s=editStudio(s,{type:'settings',settings:{channel:'copy_handle'}});s=studioAction(s,{type:'select',...first});assert.equal(editorState(s).channel,'new_handle');
});
test('brand identity edits clear cached chess identity across shows; stale Take Live selection is rejected',()=>{
  const state=defaults();state.api.profile={name:'Old identity'};state.session.baseline={blitz:1200};let s=migrateStudio(state),first=structuredClone(s.selected);
  s=studioAction(s,{type:'duplicate-show',name:'Another show'});s=editStudio(s,{type:'settings',settings:{username:'new_player'}});
  assert.throws(()=>studioAction(s,{type:'take-live',...first}),/selection changed/);
  s=studioAction(s,{type:'select',...first});assert.equal(editorState(s).api.profile,null);assert.deepEqual(editorState(s).session.baseline,{});assert.equal(s.published.state.api.profile.name,'Old identity');
});
test('portable profile template strips personal text, nested secrets, feeds and all runtime history',()=>{
  const raw=defaults();raw.username='private_player';raw.channel='private_handle';raw.theme.secret='PASSWORD';raw.widgets.stats.secret='PASSWORD';raw.session.results.push({id:'secret-history',at:1,result:'win'});raw.api.secret='PASSWORD';raw.info.text='Personal Name';raw.rss.feeds=[{id:'f',label:'Private source',url:'https://example.com/?key=PASSWORD',enabled:true}];
  const s=migrateStudio(raw),template=exportTemplate(s),json=JSON.stringify(template);assert.doesNotMatch(json,/PASSWORD|private_player|private_handle|Personal Name|secret-history|Private source/);
  assert.equal(template.shows[0].settings.rss.feeds.length,0);assert.equal(template.shows[0].settings.counters[0].value,0);
  const imported=studioAction(s,{type:'import-template',data:template});assert.equal(imported.profiles.length,2);assert.equal(editorState(imported).session.results.length,0);assert.deepEqual(imported.published,s.published);
  assert.throws(()=>studioAction(s,{type:'import-template',data:{...template,shows:[]}}));
});
test('SQLite migration is repeatable, preserves v1 document and published/draft selection over restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-migration-'));const old=applyAction(defaults(),{type:'record',result:'win'});old.username='old_player';const store=new Store(dir);store.set('state',old);store.close();
  const config={dataDir:dir,password:'test-only-password',token:'test-only-readonly-token-123',poll:false};let app;
  try{
    app=createApp(config);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
    const post=(path,data,cookie)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(data)});
    const login=await post('/api/login',{password:config.password});const cookie=login.headers.get('set-cookie').split(';')[0];
    for(const path of ['/api/studio','/api/rss/action','/api/rss/refresh'])assert.equal((await post(path+'?token='+config.token,{type:'take-live'},null)).status,401);
    assert.equal((await fetch(base+'/api/template?token='+config.token)).status,401);
    await post('/api/action',{type:'settings',settings:{channel:'staged_handle'}},cookie);
    let overlay=await(await fetch(base+'/api/state?token='+config.token,{headers:{cookie}})).json();assert.equal(overlay.channel,old.channel);assert.equal(overlay.studio,undefined);
    await post('/api/studio',{type:'create-profile',name:'New brand'},cookie);await app.close();app=createApp(config);
    assert.equal(app.getState().username,'');assert.deepEqual(app.store.get('state'),old);assert.equal(app.store.get('studio:v2').published.state.username,'old_player');
    assert.equal(app.store.get('studio:v2').profiles[0].shows[0].state.channel,'staged_handle');
  }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('generic installation performs no chess requests',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-generic-'));let calls=0;const app=createApp({dataDir:dir,password:'test-only-password',token:'test-only-token',poll:false,fetcher:async()=>{calls++;throw Error('Unexpected network');}});
  try{await app.refresh();assert.equal(calls,0);assert.equal(app.getState().username,'');}finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
