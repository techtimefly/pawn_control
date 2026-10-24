export const PLATFORMS={twitch:'Twitch',youtube:'YouTube',discord:'Discord',instagram:'Instagram',tiktok:'TikTok',x:'X',bluesky:'Bluesky',website:'Website'};
export const socialDefaults=()=>({mode:'rotate',interval:12,font:32,items:[]});
export const socialWidget=()=>({x:70,y:1050,w:900,h:120,scale:1,visible:false,locked:false,z:4});
export const enabledSocials=s=>s.items.filter(e=>e.enabled&&e.text.trim());
export function validateSocials(s){
  const text=(v,max)=>typeof v==='string'&&v.length<=max;
  if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['mode','interval','font','items'].includes(k)))throw Error('Unknown socials setting');
  if(!s||!['row','rotate'].includes(s.mode)||!Number.isFinite(s.interval)||s.interval<5||s.interval>300||!Number.isFinite(s.font)||s.font<18||s.font>60||!Array.isArray(s.items)||s.items.length>20)throw Error('Invalid socials settings (maximum 20 entries)');
  const ids=new Set();
  for(const e of s.items){
    if(e&&Object.keys(e).some(k=>!['id','platform','text','cta','enabled','icon'].includes(k)))throw Error('Unknown social entry field');
    if(!e||!text(e.id,80)||!e.id||ids.has(e.id)||!Object.hasOwn(PLATFORMS,e.platform)||!text(e.text,120)||!text(e.cta,80)||typeof e.enabled!=='boolean'||!(e.icon===null||typeof e.icon==='string'&&/^[a-f0-9]{32}$/.test(e.icon)))throw Error('Invalid social entry');
    ids.add(e.id);
  }
}
// A local elapsed-time clock: unrelated SSE updates never restart the rotation.
export class SocialTimeline {
  constructor(){this.items=[];this.id=null;this.index=0;this.elapsed=0;this.last=null;this.seq=null;this.paused=false;this.interval=12000;this.mode='rotate';}
  tick(now){if(this.last!==null&&!this.paused&&this.mode==='rotate'&&this.items.length){this.elapsed+=Math.max(0,now-this.last);if(this.elapsed>=this.interval){this.index=(this.index+Math.floor(this.elapsed/this.interval))%this.items.length;this.elapsed%=this.interval;this.id=this.items[this.index].id;}}this.last=now;return this.id;}
  update(settings,p,now){
    this.tick(now);const oldId=this.id;this.items=enabledSocials(settings);this.interval=settings.interval*1000;this.mode=settings.mode;
    const retained=this.items.findIndex(e=>e.id===oldId);this.index=retained>=0?retained:Math.min(this.index,Math.max(0,this.items.length-1));
    this.id=this.items[this.index]?.id??null;if(this.id!==oldId)this.elapsed=0;
    if(this.seq!==p.seq&&this.seq!==null&&['next','previous'].includes(p.command)){
      const from=this.items.findIndex(e=>e.id===p.currentId);this.index=((from>=0?from:this.index)+(p.command==='next'?1:-1)+this.items.length)%this.items.length||0;this.id=this.items[this.index]?.id??null;this.elapsed=0;
    }
    this.seq=p.seq;this.paused=p.paused;return this.id;
  }
}
