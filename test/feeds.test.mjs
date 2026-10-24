import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicAddress,resolveFeed,fetchFeed,parseFeed,refreshFeeds,feedAction,feedOutput} from '../lib/feeds.mjs';
import {studioDefaults} from '../public/studio-model.mjs';
import {StoryClock} from '../public/rss-render.mjs';
const now=Date.now(),config=()=>({...studioDefaults().rss,feeds:[{id:'one',label:'Example',url:'https://feeds.example/rss',enabled:true}]}),runtime=()=>({items:[],status:{},paused:false,pinned:null,seq:0});
test('RSS and Atom parse bounded plain text without evaluating entities or markup',()=>{
  const rss=parseFeed('<rss><channel><item><title><![CDATA[Hello <b>world</b>]]></title><pubDate>Fri, 23 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>');assert.equal(rss[0].title,'Hello world');assert.ok(rss[0].publishedAt);
  assert.equal(parseFeed('<feed><entry><title>News &amp; &lt;img src=x&gt; text</title><updated>2026-10-24T00:00:00Z</updated></entry></feed>')[0].title,'News & text');
  for(const xml of ['<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','<!ENTITY x "secret"><rss/>','<rss><item></rss>','<html/>','x'.repeat(1048577),'<rss>'+ '<a>'.repeat(40)])assert.throws(()=>parseFeed(xml));
});
test('SSRF rejects private, link-local, loopback, mapped and reserved IPs and mixed DNS answers',async()=>{
  for(const ip of ['127.0.0.1','0.0.0.0','10.1.2.3','172.16.1.1','192.168.1.1','169.254.169.254','100.64.0.1','224.0.0.1','198.18.0.1','::1','::','::ffff:127.0.0.1','fc00::1','fe80::1','2002:7f00:1::','2001:db8::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
  for(const url of ['http://127.1','http://2130706433','http://0x7f000001','http://[::1]','file:///etc/passwd','http://user:pass@example.com','https://example.com:8443','http://localhost'])await assert.rejects(resolveFeed(url));
  await assert.rejects(resolveFeed('https://example.com',async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]));
});
test('redirect destinations are revalidated and transport receives a pinned public address',async()=>{
  let calls=0;const resolver=async()=>[{address:'8.8.8.8',family:4}];
  await assert.rejects(fetchFeed('https://example.com',{resolver,request:async target=>{calls++;assert.equal(target.address.address,'8.8.8.8');return {location:'http://169.254.169.254/latest/meta-data'};}}));assert.equal(calls,1);
  calls=0;await assert.rejects(fetchFeed('https://example.com',{resolver,request:async()=>{calls++;return {location:'/again'};}}),/redirects/);assert.equal(calls,4);
  await assert.rejects(fetchFeed('https://example.com',{resolver,request:async()=>({xml:'a'.repeat(1048577)})}),/large/);
});
test('DNS and response stalls have a shared deadline',async()=>{
  const keepAlive=setTimeout(()=>{},1000);
  try{await assert.rejects(fetchFeed('https://example.com',{timeout:20,resolver:async()=>new Promise(()=>{})}),/timed out/);
    await assert.rejects(fetchFeed('https://example.com',{timeout:20,resolver:async()=>[{address:'8.8.8.8',family:4}],request:async()=>new Promise(()=>{})}),/timed out/);
  }finally{clearTimeout(keepAlive);}
});
test('feed caching, keyword/age filters, cross-feed dedup, approval and live controls',async()=>{
  const c=config();c.keywords='tech';c.feeds.push({id:'two',label:'Second',url:'https://other.example/rss',enabled:true});
  const fixture=async()=>[{title:'Tech headline',publishedAt:now-1000},{title:'Tech old',publishedAt:now-100*3600000},{title:'Other topic',publishedAt:now}];
  let r=await refreshFeeds(runtime(),c,fixture,now);assert.equal(r.items.length,1);assert.equal(feedOutput(r,c).items.length,0);
  r=feedAction(r,{command:'approve',id:r.items[0].id});assert.equal(feedOutput(r,c).items.length,1);
  r=feedAction(r,{command:'pin',id:r.items[0].id});assert.equal(r.pinned,r.items[0].id);r=feedAction(r,{command:'pause'});assert.equal(r.paused,true);
  r=await refreshFeeds(r,c,async()=>{throw Error('Mock failure');},now+1000);assert.equal(r.items.length,1);assert.equal(r.paused,true);assert.match(r.status.one.error,/Mock failure/);assert.equal(feedOutput(r,c).status,undefined);
  r=feedAction(r,{command:'skip'});assert.equal(r.pinned,null);assert.equal(r.seq,2);r=feedAction(r,{command:'reject',id:r.items[0].id});assert.equal(feedOutput(r,c).items.length,0);
  r=await refreshFeeds(r,c,fixture,now+2000);assert.equal(r.items[0].rejected,true);
  c.feeds[0].enabled=false;assert.equal(feedOutput(r,c).items.length,0);
});
test('automatic approval, unknown publication times and URL changes are handled without stale leakage',async()=>{
  const c=config();c.approval=false;const r=await refreshFeeds(runtime(),c,async()=>[{title:'No date'}],now);assert.equal(feedOutput(r,c).items.length,1);c.feeds[0].url='https://changed.example/rss';assert.equal(feedOutput(r,c).items.length,0);
});
test('refresh never changes displayed headline or clock mid-display; skip/pause/pin remain intentional',()=>{
  const clock=new StoryClock(),a={id:'a',title:'A'},b={id:'b',title:'B'};clock.update({items:[a],seq:0,paused:false,pinned:null},0);clock.tick(1000);
  clock.update({items:[b,a],seq:0,paused:false,pinned:null},1500);assert.equal(clock.current.id,'a');assert.equal(clock.elapsed,1500);
  clock.update({items:[b,a],seq:0,paused:true,pinned:null},2000);clock.tick(4000);assert.equal(clock.elapsed,2000);
  clock.update({items:[b,a],seq:1,paused:true,pinned:'b'},5000);assert.equal(clock.current.id,'b');assert.equal(clock.elapsed,0);
  clock.update({items:[a],seq:1,paused:false,pinned:null},6000);assert.equal(clock.current.id,'b');clock.advance();assert.equal(clock.current.id,'a');
});
