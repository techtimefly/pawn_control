import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {defaults} from '../public/model.mjs';
import {canvasSize,upgradeFormats} from '../public/formats.mjs';
import {applyAction,settingsOf,validateSettings} from '../lib/state.mjs';
import {migrateStudio,studioAction,editStudio,editorState,exportTemplate} from '../lib/studio.mjs';
import {Store} from '../lib/store.mjs';
import {createApp} from '../server.mjs';

test('legacy format upgrade preserves landscape exactly and authors a separate portrait layout',()=>{
  const old=defaults();delete old.outputFormat;delete old.layouts;old.widgets.stats.x=1800;old.widgets.info.visible=true;
  const upgraded=upgradeFormats(old);assert.equal(upgraded.outputFormat,'landscape');assert.deepEqual(upgraded.widgets,old.widgets);assert.deepEqual(upgraded.layouts.landscape,old.widgets);assert.equal(upgraded.layouts.vertical.stats.x,40);assert.equal(upgraded.layouts.vertical.stats.w,1000);assert.equal(upgraded.layouts.vertical.info.visible,true);
  assert.deepEqual(upgradeFormats(upgraded),upgraded);validateSettings(settingsOf(upgraded));
});
test('repeated format switching preserves independent positions, sizes, visibility and layer values',()=>{
  let s=defaults();s.widgets.info={...s.widgets.info,x:120,y:220,w:800,h:180,z:8,visible:true};const landscape=structuredClone(s.widgets);
  s=applyAction(s,{type:'settings',settings:{outputFormat:'vertical'}});assert.deepEqual(canvasSize(s),{label:'Vertical',width:1080,height:1920});assert.notEqual(s.widgets.info.x,landscape.info.x);
  const widgets=structuredClone(s.widgets);widgets.info={...widgets.info,x:60,y:900,w:960,h:240,z:12,visible:false};s=applyAction(s,{type:'settings',settings:{widgets}});const vertical=structuredClone(s.widgets);
  for(let i=0;i<3;i++){s=applyAction(s,{type:'settings',settings:{outputFormat:'landscape'}});assert.deepEqual(s.widgets,landscape);s=applyAction(s,{type:'settings',settings:{outputFormat:'vertical'}});assert.deepEqual(s.widgets,vertical);}
});
test('validation checks bounds of both active and inactive layouts and rejects unknown formats',()=>{
  const s=applyAction(defaults(),{type:'settings',settings:{outputFormat:'vertical'}});
  for(const edit of [w=>w.x=1080,w=>w.y=1920,w=>w.w=1081,w=>w.h=1921]){const widgets=structuredClone(s.widgets);edit(widgets.info);assert.throws(()=>applyAction(s,{type:'settings',settings:{widgets}}),/canvas/);}
  const layouts=structuredClone(s.layouts);layouts.landscape.ticker.y=1440;assert.throws(()=>applyAction(s,{type:'settings',settings:{layouts}}),/canvas/);
  assert.throws(()=>applyAction(s,{type:'settings',settings:{outputFormat:'square'}}));
  const widgets=structuredClone(s.widgets);widgets.info={...widgets.info,x:0,y:0,w:1080,h:1920};assert.doesNotThrow(()=>applyAction(s,{type:'settings',settings:{widgets}}));
});
test('format changes and layout edits stay staged until Take Live and remain isolated between shows',()=>{
  let s=migrateStudio(defaults());const first=structuredClone(s.selected),published=structuredClone(s.published);
  s=editStudio(s,{type:'settings',settings:{outputFormat:'vertical'}});assert.deepEqual(s.published,published);
  const widgets=structuredClone(editorState(s).widgets);widgets.info.y=800;s=editStudio(s,{type:'settings',settings:{widgets}});assert.deepEqual(s.published,published);
  s=studioAction(s,{type:'take-live'});assert.equal(s.published.state.outputFormat,'vertical');assert.equal(s.published.state.widgets.info.y,800);
  s=studioAction(s,{type:'create-show',name:'Landscape show'});assert.equal(editorState(s).outputFormat,'landscape');assert.equal(s.published.state.outputFormat,'vertical');
  s=studioAction(s,{type:'select',...first});assert.equal(editorState(s).widgets.info.y,800);
});
test('presets, backups and sanitized templates round trip both layouts',()=>{
  let s=applyAction(defaults(),{type:'settings',settings:{outputFormat:'vertical'}});s.widgets.info.y=810;s=applyAction(s,{type:'save-preset',name:'Portrait'});
  s=applyAction(s,{type:'settings',settings:{outputFormat:'landscape'}});s=applyAction(s,{type:'load-preset',name:'Portrait'});assert.equal(s.outputFormat,'vertical');assert.equal(s.widgets.info.y,810);
  const restored=applyAction(defaults(),{type:'import',data:{version:1,settings:settingsOf(s),session:s.session,presets:s.presets}});assert.deepEqual(restored.layouts,s.layouts);
  const studio=migrateStudio(restored),template=exportTemplate(studio),imported=studioAction(studio,{type:'import-template',data:template});assert.equal(editorState(imported).outputFormat,'vertical');assert.deepEqual(editorState(imported).layouts,restored.layouts);
});
test('pre-format studio data migrates without modifying live output; both layouts and selected format survive restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-formats-'));const legacy=migrateStudio(defaults());for(const s of [legacy.published.state,legacy.profiles[0].shows[0].state]){delete s.outputFormat;delete s.layouts;s.widgets.stats.x=1800;}
  const store=new Store(dir);store.set('studio:v2',legacy);store.close();const config={dataDir:dir,password:'disposable-test-password',token:'disposable-test-readonly-token',poll:false};let app=createApp(config);
  try{
    assert.equal(app.getState().widgets.stats.x,1800);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
    const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:config.password})});const cookie=login.headers.get('set-cookie').split(';')[0];
    const post=async(path,data)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});assert.equal(res.status,200);return res.json();};
    await post('/api/action',{type:'settings',settings:{outputFormat:'vertical'}});let live=await(await fetch(base+'/api/state?token='+config.token)).json();assert.equal(live.outputFormat,'landscape');assert.equal(live.widgets.stats.x,1800);
    await post('/api/studio',{type:'take-live'});await post('/api/action',{type:'settings',settings:{outputFormat:'landscape'}});await app.close();app=createApp(config);
    assert.equal(app.getState().outputFormat,'landscape');assert.equal(app.getState().widgets.stats.x,1800);const saved=app.store.get('studio:v2');assert.equal(saved.published.state.outputFormat,'vertical');assert.equal(saved.published.state.widgets.stats.x,40);assert.equal(saved.profiles[0].shows[0].state.layouts.vertical.stats.w,1000);
  }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
