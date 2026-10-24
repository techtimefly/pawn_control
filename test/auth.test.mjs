import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {authenticationConfig,parseAuthRequired} from '../lib/auth-config.mjs';
import {createApp} from '../server.mjs';

test('AUTH_REQUIRED defaults to true and accepts only explicit true/false',()=>{
  for(const v of [undefined,true,'true'])assert.equal(parseAuthRequired(v),true);
  for(const v of [false,'false'])assert.equal(parseAuthRequired(v),false);
  for(const v of ['',null,0,1,'0','1','FALSE','yes',' true '])assert.throws(()=>parseAuthRequired(v),/AUTH_REQUIRED must be true or false/);
});

test('credentials are required only in authenticated mode and examples or invalid lengths fail',()=>{
  const valid={password:'a'.repeat(16),token:'b'.repeat(24)};
  assert.equal(authenticationConfig(valid).authRequired,true);
  assert.throws(()=>authenticationConfig({}),/CONTROL_PASSWORD/);
  for(const password of ['', 'a'.repeat(15),'a'.repeat(1025),'replace-with-password'])assert.throws(()=>authenticationConfig({...valid,password}),/CONTROL_PASSWORD/);
  for(const token of ['', 'a'.repeat(23),'replace-with-a-long-random-token'])assert.throws(()=>authenticationConfig({...valid,token}),/OVERLAY_TOKEN/);
  assert.deepEqual(authenticationConfig({authRequired:false}),{authRequired:false,password:undefined,token:undefined});
  assert.deepEqual(authenticationConfig({authRequired:'false',password:'short',token:'short'}),{authRequired:false,password:undefined,token:undefined});
});

test('open mode needs no login or token, preserves POST protections, and re-enabling auth restores all gates',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'pawn-auth-'));
  const config={dataDir:dir,username:'test_player',poll:false,password:'test-password-123456789',token:'read-only-token-1234567890'};
  let app,base;
  async function start(options){app=createApp({...config,...options});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;}
  const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  try {
    await start({});
    const login=await post('/api/login',{password:config.password});const cookie=login.headers.get('set-cookie').split(';')[0];
    await app.close();app=null;
    await start({authRequired:false,password:undefined,token:undefined});
    assert.equal((await fetch(base+'/api/state')).status,200);
    assert.equal((await fetch(base+'/api/state?token=old-token')).status,200);
    const admin=await(await fetch(base+'/api/admin')).json();assert.equal(admin.authRequired,false);assert.equal(admin.token,undefined);
    for(const path of ['/api/login','/api/logout']){const res=await post(path,{});assert.equal(res.status,200);assert.equal(res.headers.get('set-cookie'),null);}
    const stream=await fetch(base+'/api/events');const reader=stream.body.getReader();assert.match(new TextDecoder().decode((await reader.read()).value),/event: state/);
    assert.equal((await post('/api/action',{type:'record',result:'draw'})).status,200);
    assert.match(new TextDecoder().decode((await reader.read()).value),/"result":"draw"/);await reader.cancel();
    assert.equal((await post('/api/action',{type:'credits-playback',command:'restart'})).status,200);
    assert.equal((await post('/api/action',{type:'record',result:'win'},{origin:'http://evil.example'})).status,403);
    assert.equal((await post('/api/action',{type:'record',result:'win'},{'sec-fetch-site':'cross-site'})).status,403);
    assert.equal((await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await post('/api/action',{type:'record',result:'invalid'})).status,400);
    const backup=await(await fetch(base+'/api/export')).json();assert.equal(backup.session.results.length,1);assert.equal(backup.authRequired,undefined);
    await app.close();app=null;
    await start({authRequired:true});
    for(const path of ['/api/state','/api/events','/api/admin','/api/export'])assert.equal((await fetch(base+path,{headers:{cookie}})).status,401);
    assert.equal((await post('/api/action',{type:'record',result:'win'},{cookie})).status,401);
    assert.equal((await post(`/api/action?token=${config.token}`,{type:'record',result:'win'})).status,401);
    const state=await(await fetch(base+`/api/state?token=${config.token}`)).json();assert.equal(state.session.results.length,1);
    const newLogin=await post('/api/login',{password:config.password});assert.equal(newLogin.status,200);
    const newCookie=newLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await(await fetch(base+'/api/admin',{headers:{cookie:newCookie}})).json()).authRequired,true);
  } finally {if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});
