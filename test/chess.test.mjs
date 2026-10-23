import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChessClient } from '../lib/chess.mjs';
import { defaults } from '../public/model.mjs';
const memory=()=>{const m=new Map();return {get:k=>m.get(k),set:(k,v)=>m.set(k,v)};};
test('API respects max-age and validators across checks',async()=>{
  let now=1000000,count=0,seen;
  const c=new ChessClient(memory(),{now:()=>now,fetcher:async(url,options)=>{count++;seen=options.headers;return count===1?new Response('{"ok":1}',{headers:{'cache-control':'max-age=600','etag':'abc'}}):new Response(null,{status:304});}});
  assert.deepEqual(await c.resource('player/stats',300000),{ok:1});
  now+=300000;await c.resource('player/stats',300000);assert.equal(count,1);
  now+=300001;await c.resource('player/stats',300000);assert.equal(count,2);assert.equal(seen['If-None-Match'],'abc');
});
test('429 backoff survives checks and preserves last known data',async()=>{
  let now=1000,count=0;const store=memory();
  const c=new ChessClient(store,{now:()=>now,fetcher:async()=>{count++;return new Response('',{status:429,headers:{'retry-after':'900'}});}});
  await assert.rejects(c.resource('p',300000),/429/);now+=400000;
  await assert.rejects(c.resource('p',300000),/429/);assert.equal(count,1);
});
test('requests are serial and disabled history avoids archive requests',async()=>{
  let active=0,max=0;const urls=[];let s=defaults();
  const c=new ChessClient(memory(),{fetcher:async url=>{active++;max=Math.max(max,active);urls.push(url);await new Promise(r=>setTimeout(r,5));active--;return Response.json(url.endsWith('/stats')?{chess_blitz:{last:{rating:408}}}:{username:s.username});}});
  await c.refresh(()=>s,next=>s=next);assert.equal(max,1);assert.equal(urls.length,2);assert.equal(s.session.baseline.blitz,408);
});
test('historical refresh spans year boundary, strips unused game fields, and preserves session',async()=>{
  const urls=[];let s=defaults();s.fields.find(f=>f.id==='form').visible=true;
  const c=new ChessClient(memory(),{now:()=>Date.UTC(2026,0,2),fetcher:async url=>{urls.push(url);return Response.json(url.includes('/games/')?{games:[{white:{username:s.username,result:'win'},black:{username:'opponent',result:'resigned'},time_class:'blitz',rules:'chess',end_time:1,pgn:'unused'}]}:{});}});
  await c.refresh(()=>s,next=>s=next);assert.ok(urls.some(u=>u.endsWith('/2026/01')));assert.ok(urls.some(u=>u.endsWith('/2025/12')));assert.equal(s.api.games[0].pgn,undefined);assert.equal(s.session.results.length,0);
});
