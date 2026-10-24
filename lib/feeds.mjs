import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';

// Only globally routable unicast destinations. IPv4-mapped and transition IPv6
// are deliberately rejected rather than permitting alternate private IP spellings.
export function publicAddress(address) {
  if(isIP(address)===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
  }
  if(isIP(address)===6){
    const normalized=new URL(`http://[${address}]/`).hostname.slice(1,-1).toLowerCase();
    const first=parseInt(normalized.split(':')[0],16);
    const second=parseInt(normalized.split(':')[1]||'0',16);
    return first>=0x2000&&first<=0x3fff&&!(first===0x2001&&(second<0x200||second===0xdb8))&&first!==0x2002&&first!==0x3fff;
  }
  return false;
}
export async function resolveFeed(raw,resolver=lookup) {
  const u=new URL(raw);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||u.port&&(u.protocol==='https:'?u.port!=='443':u.port!=='80'))throw Error('Feed URL must use HTTP/HTTPS on its standard port without credentials');
  const host=u.hostname.replace(/^\[|\]$/g,'');
  if(host.toLowerCase()==='localhost'||host.endsWith('.localhost')||host.includes('%'))throw Error('Private feed host rejected');
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await resolver(host,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(x=>!publicAddress(x.address)))throw Error('Non-public feed address rejected');
  return {url:u,address:addresses[0]};
}
function requestFeed({url,address},signal) {
  return new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).get(url,{signal,agent:false,headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','Accept-Encoding':'identity','User-Agent':'PawnControl RSS/1.0'},lookup:(_host,options,callback)=>callback(null,...(options.all?[[address]]:[address.address,address.family]))},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){const location=res.headers.location;res.destroy();return resolve({location});}
      if(res.statusCode!==200){res.destroy();return reject(Error(`Feed HTTP ${res.statusCode}`));}
      if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();return reject(Error('Compressed feeds are not supported'));}
      if(Number(res.headers['content-length'])>1048576){res.destroy();return reject(Error('Feed too large'));}
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>1048576){res.destroy(Error('Feed too large'));return;}chunks.push(chunk);});
      res.on('error',reject);res.on('end',()=>resolve({xml:Buffer.concat(chunks).toString('utf8')}));
    });req.on('error',reject);
  });
}
export async function fetchFeed(raw,{resolver=lookup,request=requestFeed,timeout=10000}={}) {
  const signal=AbortSignal.timeout(timeout);
  // A deadline also bounds DNS and injected transports, not just the HTTP socket.
  return Promise.race([(async()=>{let url=raw;
    for(let i=0;i<4;i++){
      const target=await resolveFeed(url,resolver);signal.throwIfAborted();const result=await request(target,signal);signal.throwIfAborted();
      if(result.location){url=new URL(result.location,target.url).href;continue;}
      if(typeof result.xml!=='string'||Buffer.byteLength(result.xml)>1048576)throw Error('Feed too large or empty');return parseFeed(result.xml);
    }throw Error('Too many feed redirects');
  })(),new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('Feed timed out')),{once:true}))]);
}
const plain=value=>value.replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>{
  if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';}
  return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v.toLowerCase()];
}).replace(/<[^>]*>/g,' ').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,600);
// Bounded, non-validating XML tokenizer: never loads entities, DTDs or resources.
// Unknown entities are inert text. Reject declarations rather than expand them.
export function parseFeed(xml) {
  if(typeof xml!=='string'||Buffer.byteLength(xml)>1048576||/<!\s*(?:DOCTYPE|ENTITY)/i.test(xml))throw Error('Unsafe or oversized feed XML');
  const tokens=xml.match(/<!--[\s\S]*?-->|<\?[^]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/g)||[];
  if(tokens.join('')!==xml)throw Error('Malformed feed XML');
  const stack=[],items=[];let item=null,root=null;
  for(const token of tokens){
    if(token.startsWith('<!--')||token.startsWith('<?'))continue;
    if(token.startsWith('<![CDATA[')){if(item)item.fields[stack.at(-1)]=(item.fields[stack.at(-1)]||'')+token.slice(9,-3);continue;}
    if(token.startsWith('<!'))throw Error('Unsupported XML declaration');
    if(token.startsWith('</')){const m=token.match(/^<\/([\w:.-]+)\s*>$/);if(!m||stack.pop()!==m[1])throw Error('Malformed feed XML');
      if(item&&stack.length===item.depth-1){items.push(item.fields);item=null;if(items.length>1000)throw Error('Too many feed items');}continue;}
    if(token.startsWith('<')){const m=token.match(/^<([\w:.-]+)(?:\s[^<>]*)?\s*\/?>$/);if(!m)throw Error('Malformed feed XML');const tag=m[1];
      if(!root)root=tag;
      if(!token.endsWith('/>')){stack.push(tag);if(stack.length>32)throw Error('Feed XML too deep');if(['item','entry'].includes(tag)){if(item)throw Error('Nested feed items');item={depth:stack.length,fields:{}};}}
      continue;
    }
    if(item){const tag=stack.at(-1);item.fields[tag]=(item.fields[tag]||'')+token;}
  }
  if(stack.length||!['rss','feed','rdf:RDF'].includes(root))throw Error('Malformed or unsupported feed XML');
  return items.map(x=>({title:plain(x.title||''),source:plain(x.source||''),publishedAt:Date.parse(x.pubDate||x.published||x.updated||x['dc:date']||'')||null})).filter(x=>x.title).slice(0,300);
}
export function eligibleItems(runtime,config,now=Date.now()) {
  const feeds=new Map(config.feeds.filter(f=>f.enabled).map((f,i)=>[f.id,{...f,order:i}]));
  const words=config.keywords.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
  return runtime.items.filter(x=>{const f=feeds.get(x.feedId);return f&&f.url===x.feedUrl&&now-(x.publishedAt||x.fetchedAt)<=config.maxAgeHours*3600000&&(!x.publishedAt||x.publishedAt<=now+300000)&&(!words.length||words.some(w=>x.title.toLowerCase().includes(w)));}).sort((a,b)=>feeds.get(a.feedId).order-feeds.get(b.feedId).order||b.fetchedAt-a.fetchedAt);
}
export async function refreshFeeds(runtime,config,fetcher=fetchFeed,now=Date.now()) {
  const next=structuredClone(runtime);
  for(const feed of config.feeds.filter(f=>f.enabled)){
    try{
      const stories=await fetcher(feed.url);
      for(const story of stories){
        const title=plain(story.title||'');if(!title)continue;
        const id=createHash('sha256').update(title.toLowerCase()).digest('hex');
        if(next.items.some(x=>x.id===id))continue;
        next.items.push({id,feedId:feed.id,feedUrl:feed.url,title,source:plain(feed.label||story.source||new URL(feed.url).hostname),publishedAt:Number.isFinite(story.publishedAt)?story.publishedAt:null,fetchedAt:now,approved:!config.approval,rejected:false});
      }
      next.status[feed.id]={checkedAt:now,successAt:now,error:null};
    }catch(e){next.status[feed.id]={...next.status[feed.id],checkedAt:now,error:String(e.message).slice(0,200)};}
  }
  next.items=eligibleItems(next,config,now).slice(-1000);return next;
}
export function feedAction(runtime,a) {
  const r=structuredClone(runtime);
  if(a.command==='pause')r.paused=true;
  else if(a.command==='play')r.paused=false;
  else if(a.command==='skip'){r.pinned=null;r.seq++;}
  else if(a.command==='unpin')r.pinned=null;
  else {const item=r.items.find(x=>x.id===a.id);if(!item)throw Error('Story not found');
    if(a.command==='approve'){item.approved=true;item.rejected=false;}
    else if(a.command==='reject'){item.approved=false;item.rejected=true;if(r.pinned===item.id)r.pinned=null;}
    else if(a.command==='pin'){if(!item.approved)throw Error('Approve story before pinning');r.pinned=item.id;r.seq++;}
    else throw Error('Unknown feed command');
  }return r;
}
export function feedOutput(runtime,config) {
  return {items:eligibleItems(runtime,config).filter(x=>x.approved&&!x.rejected).map(({id,title,source,publishedAt})=>({id,title,source,publishedAt})),paused:runtime.paused,pinned:runtime.pinned,seq:runtime.seq};
}
