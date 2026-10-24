import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';

test('late chess responses cannot populate a different published profile',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-chess-race-'));let release;
  const app=createApp({dataDir:dir,password:'disposable-test-password',token:'disposable-test-readonly-token',username:'fixture_player',poll:false,fetcher:async url=>{if(url.endsWith('/stats'))await new Promise(r=>release=r);return new Response(JSON.stringify(url.endsWith('/stats')?{chess_blitz:{last:{rating:1200}}}:{name:'Old player'}),{headers:{'Content-Type':'application/json'}});}});
  try{
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
    const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'disposable-test-password'})});const cookie=login.headers.get('set-cookie').split(';')[0];
    const pending=app.refresh();await new Promise(r=>setImmediate(r));
    for(const data of [{type:'create-profile',name:'Generic'},{type:'take-live'}])assert.equal((await fetch(base+'/api/studio',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)})).status,200);
    release();await pending;const live=await(await fetch(base+'/api/state?token=disposable-test-readonly-token')).json();assert.equal(live.username,'');assert.equal(live.api.profile,null);assert.equal(live.api.stats,null);assert.deepEqual(live.session.baseline,{});
  }finally{release?.();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('published SSE, feed refresh races and per-show queue persistence across switching and restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'studio-feed-http-'));let release,blocking=false,calls=0;
  const config={dataDir:dir,password:'disposable-test-password',token:'disposable-test-readonly-token',poll:false,feedFetcher:async()=>{calls++;if(blocking)await new Promise(r=>release=r);return [{title:'Fixture headline',publishedAt:Date.now()}];}};
  let app=createApp(config),base,cookie,reader;
  const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;const res=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:config.password})});cookie=res.headers.get('set-cookie').split(';')[0];};
  const post=async(path,data)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});assert.equal(res.status,200);return (await res.json()).state;};
  const overlay=async()=>await(await fetch(base+'/api/state?token='+config.token)).json();
  try{
    await start();const first=structuredClone(app.store.get('studio:v2').selected);
    const rss={...app.getState().rss,feeds:[{id:'feed',label:'Fixture',url:'https://feed.example/rss',enabled:true}]};
    await post('/api/action',{type:'settings',settings:{info:{title:'Draft card',text:'draft'},rss}});assert.notEqual((await overlay()).info.title,'Draft card');
    assert.equal(calls,0);await post('/api/studio',{type:'take-live'});await app.refreshRSS();let privateState=await(await fetch(base+'/api/state',{headers:{cookie}})).json();const story=privateState.studio.rssRuntime.items[0];assert.ok(story);assert.equal((await overlay()).rssOutput.items.length,0);
    await post('/api/rss/action',{command:'approve',id:story.id});assert.equal((await overlay()).rssOutput.items[0].title,'Fixture headline');
    blocking=true;const refresh=app.refreshRSS();await new Promise(r=>setImmediate(r));await post('/api/rss/action',{command:'pause'});await post('/api/rss/action',{command:'reject',id:story.id});release();await refresh;assert.equal((await overlay()).rssOutput.paused,true);assert.equal((await overlay()).rssOutput.items.length,0);
    await post('/api/rss/action',{command:'approve',id:story.id});
    const stream=await fetch(base+'/api/events?token='+config.token);reader=stream.body.getReader();await reader.read();
    await post('/api/studio',{type:'create-profile',name:'Another brand'});let text=new TextDecoder().decode((await reader.read()).value);assert.match(text,/Draft card/);assert.doesNotMatch(text,/Another brand/);
    const second=structuredClone(app.store.get('studio:v2').selected);
    const interrupted=app.refreshRSS();await new Promise(r=>setImmediate(r));await post('/api/studio',{type:'take-live'});release();await interrupted;
    assert.equal((await overlay()).rssOutput.items.length,0);await reader.cancel();reader=null;
    await post('/api/studio',{type:'select',...first});await post('/api/studio',{type:'take-live'});assert.equal((await overlay()).rssOutput.items.length,1);assert.equal((await overlay()).rssOutput.paused,true);
    await post('/api/studio',{type:'select',...second});await app.close();app=createApp(config);await start();assert.equal(app.getState().username,'');assert.equal((await overlay()).info.title,'Draft card');assert.equal((await overlay()).rssOutput.items.length,1);
  }finally{release?.();if(reader)await reader.cancel();await app.close();rmSync(dir,{recursive:true,force:true});}
});
