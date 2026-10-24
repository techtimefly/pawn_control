import { randomUUID } from 'node:crypto';
import { defaults, totals, newSession, rating, MODES, FIELDS,WIDGET_IDS } from '../public/model.mjs';
import {upgradeBonusSettings,nextTipIndex} from '../public/bonus-model.mjs';
import {upgradeStudio} from '../public/studio-model.mjs';
import {FORMATS,formatSettings} from '../public/formats.mjs';
const fail = message => { throw new Error(message); };
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v,min,max) => Number.isFinite(v) && v >= min && v <= max;
const str = (v,max) => typeof v === 'string' && v.length <= max;
export function validateSettings(s) {
  if (!obj(s)) fail('Invalid settings');
  if (Object.keys(s).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
  if (typeof s.username!=='string'||typeof s.channel!=='string'||(s.username!==''&&!/^[a-zA-Z0-9_-]{2,50}$/.test(s.username)) || (s.channel!==''&&!/^[a-zA-Z0-9_]{2,30}$/.test(s.channel))) fail('Invalid player or channel');
  if (!MODES.includes(s.activeMode)) fail('Invalid time control');
  if (typeof s.showAvatar !== 'boolean') fail('Invalid avatar setting');
  if (!Array.isArray(s.fields) || s.fields.length !== Object.keys(FIELDS).length || new Set(s.fields.map(f=>f.id)).size !== s.fields.length || s.fields.some(f=>!FIELDS[f.id] || typeof f.visible !== 'boolean')) fail('Invalid fields');
  for (const k of ['win','loss','draw']) if (typeof s.parts?.[k] !== 'boolean') fail('Invalid score visibility');
  for (const m of MODES) {
    if (!Number.isInteger(s.goals?.[m]) || !num(s.goals[m],1,10000)) fail('Goal must be 1–10000');
    if (s.overrides?.[m] !== null && (!Number.isInteger(s.overrides?.[m]) || !num(s.overrides[m],0,10000))) fail('Invalid rating override');
  }
  for (const k of ['accent','background','foreground','muted','streak']) if (!/^#[a-fA-F0-9]{6}$/.test(s.theme?.[k])) fail('Invalid color');
  for (const [k,min,max] of [['opacity',0,100],['radius',0,60],['font',18,60],['padding',10,60],['gap',4,40]]) if (!num(s.theme[k],min,max)) fail(`Invalid ${k}`);
  if (typeof s.layoutLocked !== 'boolean' || typeof s.snap !== 'boolean') fail('Invalid layout settings');
  if(!Object.hasOwn(FORMATS,s.outputFormat)||!obj(s.layouts)||Object.keys(s.layouts).some(k=>!Object.hasOwn(FORMATS,k)))fail('Invalid output format');
  for(const [format,{width,height}] of Object.entries(FORMATS))for(const layout of [s.layouts[format],...(format===s.outputFormat?[s.widgets]:[])])for(const id of WIDGET_IDS){
    const w=layout?.[id];
    if(!obj(w)||!num(w.x,0,width)||!num(w.y,0,height)||!num(w.w,150,width)||!num(w.h,40,height)||w.x+w.w>width+.1||w.y+w.h>height+.1||!num(w.scale,.5,2)||!Number.isInteger(w.z)||!num(w.z,0,50)||typeof w.visible!=='boolean'||typeof w.locked!=='boolean')fail('Widget must fit the canvas');
  }
  const t=s.ticker;
  if (!obj(t) || !['scroll','rotate'].includes(t.mode) || !num(t.interval,5,300) || !num(t.speed,20,300) || !num(t.gap,0,300) || !num(t.pause,0,30) || !num(t.font,18,60) || !num(t.opacity,0,100) || !['left','right'].includes(t.direction) || typeof t.paused !== 'boolean' || !str(t.separator,12)) fail('Invalid ticker settings');
  if (!Array.isArray(t.messages) || t.messages.length>50 || new Set(t.messages.map(m=>m.id)).size!==t.messages.length || t.messages.some(m=>!str(m.id,80) || !str(m.text,500) || typeof m.enabled!=='boolean')) fail('Invalid ticker messages');
  const c=s.credits,p=s.tips;
  if(!obj(c)||!str(c.brand,120)||!str(c.subtitle,200)||!str(c.final,200)||!['duration','speed'].includes(c.timing)||!num(c.duration,5,1800)||!num(c.speed,10,300)||!num(c.font,20,90)||!num(c.heading,24,120)||!num(c.brandSize,30,180)||!num(c.gap,10,180)||!num(c.opacity,0,100)||typeof c.loop!=='boolean')fail('Invalid credits settings');
  for(const k of ['background','accent','headingColor','detailColor'])if(!/^#[a-fA-F0-9]{6}$/.test(c[k]))fail('Invalid credits color');
  if(!Array.isArray(c.sections)||c.sections.length>30||new Set(c.sections.map(x=>x.id)).size!==c.sections.length)fail('Invalid credit sections');
  for(const section of c.sections){
    if(!str(section.id,80)||!str(section.title,120)||typeof section.enabled!=='boolean'||!Array.isArray(section.entries)||section.entries.length>60||new Set(section.entries.map(e=>e.id)).size!==section.entries.length)fail('Invalid credit section');
    for(const e of section.entries)if(!str(e.id,80)||!str(e.label,200)||!str(e.detail,400)||typeof e.enabled!=='boolean')fail('Invalid credit entry');
  }
  if(!obj(p)||!num(p.interval,5,300)||!num(p.font,18,60)||!['sequential','shuffle'].includes(p.order)||!Array.isArray(p.items)||p.items.length>100||new Set(p.items.map(x=>x.id)).size!==p.items.length)fail('Invalid tips settings');
  for(const tip of p.items)if(!str(tip.id,80)||!str(tip.title,120)||!str(tip.category,60)||!str(tip.text,600)||typeof tip.enabled!=='boolean')fail('Invalid chess tip');
  if(!obj(s.info)||!str(s.info.title,120)||!str(s.info.text,1000))fail('Invalid information card');
  if(!Array.isArray(s.counters)||s.counters.length>20||new Set(s.counters.map(c=>c.id)).size!==s.counters.length||s.counters.some(c=>!str(c.id,80)||!str(c.label,120)||!Number.isSafeInteger(c.value)||Math.abs(c.value)>1000000))fail('Invalid counters');
  const r=s.rss;
  if(!obj(r)||!Array.isArray(r.feeds)||r.feeds.length>10||new Set(r.feeds.map(f=>f.id)).size!==r.feeds.length||!str(r.keywords,500)||!num(r.maxAgeHours,1,720)||typeof r.approval!=='boolean'||typeof r.showTime!=='boolean'||!['rotate','scroll'].includes(r.mode)||!num(r.interval,5,300)||!num(r.speed,20,300)||!num(r.gap,0,300)||!num(r.pause,0,30)||!num(r.font,18,60)||!num(r.opacity,0,100)||!['left','right'].includes(r.direction)||typeof r.paused!=='boolean'||!str(r.separator,12))fail('Invalid RSS settings');
  for(const f of r.feeds){if(!str(f.id,80)||!str(f.label,120)||!str(f.url,2048)||typeof f.enabled!=='boolean')fail('Invalid feed');let u;try{u=new URL(f.url);}catch{fail('Invalid feed URL');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||(u.port&&!['80','443'].includes(u.port)))fail('Invalid feed URL');}
  return s;
}
export const SETTING_KEYS = ['username','channel','activeMode','showAvatar','fields','parts','goals','overrides','theme','widgets','layoutLocked','snap','ticker','credits','tips','info','counters','rss','outputFormat','layouts'];
export function settingsOf(state) { const result=Object.fromEntries(SETTING_KEYS.map(k=>[k,structuredClone(state[k])]));if(result.layouts)result.layouts[result.outputFormat]=structuredClone(result.widgets);return result; }
export function validateSession(s) {
  if (!obj(s) || !Array.isArray(s.results) || s.results.length>10000 || s.results.some(r=>!['win','loss','draw'].includes(r.result)||!str(r.id,80)||!num(r.at,0,1e15)) || new Set(s.results.map(r=>r.id)).size!==s.results.length) fail('Invalid results');
  for (const k of ['win','loss','draw']) if (!Number.isInteger(s.corrections?.[k]) || !num(s.corrections[k],-10000,10000)) fail('Invalid corrections');
  if (Object.values(totals(s)).some(v=>v<0 || v>10000) || !num(s.startedAt,0,1e15) || !num(s.elapsed,0,1e12) || (s.runningSince!==null && !num(s.runningSince,0,Date.now()+60000))) fail('Invalid session');
  if (!obj(s.baseline)) fail('Invalid baselines');
  for (const [k,v] of Object.entries(s.baseline)) if (!MODES.includes(k) || (v!==null && !num(v,0,10000))) fail('Invalid baseline');
}
export function applyAction(original, action) {
  const s=structuredClone(original), a=action;
  if (!obj(a)) fail('Invalid action');
  const remember = () => { s.undo.push(structuredClone(s.session)); s.undo=s.undo.slice(-30); };
  if(a.type==='counter-live') {
    const counter=s.counters.find(c=>c.id===a.id);if(!counter||![-1,1].includes(a.delta)||Math.abs(counter.value+a.delta)>1000000)fail('Invalid counter');counter.value+=a.delta;
  } else if(a.type==='ticker-live') {
    if(typeof a.paused!=='boolean')fail('Invalid ticker pause');s.ticker.paused=a.paused;
  } else if (a.type==='settings') {
    if (!obj(a.settings) || Object.keys(a.settings).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
    const merged=formatSettings(settingsOf(s),a.settings); validateSettings(merged);
    const changed=merged.username!==s.username; Object.assign(s,merged);
    if (changed) { s.api=defaults().api; s.session.baseline={}; }
  } else if (a.type==='record') {
    if (!['win','loss','draw'].includes(a.result)) fail('Invalid result');
    if (s.session.results.length>=10000) fail('Start a new session');
    remember(); s.session.results.push({ id: randomUUID(), at: Date.now(), result: a.result });
  } else if (a.type==='decrement') {
    if (!['win','loss','draw'].includes(a.result)) fail('Invalid result');
    if (!totals(s.session)[a.result]) return s;
    remember();
    if (s.session.corrections[a.result]>0) s.session.corrections[a.result]--;
    else { const i=s.session.results.findLastIndex(r=>r.result===a.result); s.session.results.splice(i,1); }
  } else if (a.type==='totals') {
    remember();
    for (const k of ['win','loss','draw']) {
      if (!Number.isInteger(a.totals?.[k]) || !num(a.totals[k],0,10000)) fail('Invalid total');
      s.session.corrections[k]=a.totals[k]-s.session.results.filter(r=>r.result===k).length;
    }
  } else if (a.type==='edit-result' || a.type==='delete-result') {
    const i=s.session.results.findIndex(r=>r.id===a.id); if (i<0) fail('Result not found');
    remember();
    if (a.type==='delete-result') s.session.results.splice(i,1);
    else { if (!['win','loss','draw'].includes(a.result)) fail('Invalid result'); s.session.results[i].result=a.result; }
    // Preserve valid totals if a prior manual correction made a count smaller than ordered history.
    const t=totals(s.session); for (const k of ['win','loss','draw']) if (t[k]<0) s.session.corrections[k]-=t[k];
  } else if (a.type==='reset') {
    remember(); s.session=newSession(Object.fromEntries(MODES.map(m=>[m,rating(s,m)])));
  } else if (a.type==='undo') {
    if (s.undo.length) s.session=s.undo.pop();
  } else if (a.type==='timer') {
    const command=a.command || (s.session.runningSince!==null?'pause':'start');
    if(!['start','pause','restart'].includes(command))fail('Invalid timer command');
    if(command==='start' && s.session.runningSince!==null)return s;
    if(command==='pause' && s.session.runningSince===null)return s;
    remember();
    if(command==='restart'){s.session.elapsed=0;s.session.runningSince=Date.now();}
    else if(command==='pause'){s.session.elapsed+=Math.max(0,Date.now()-s.session.runningSince);s.session.runningSince=null;}
    else s.session.runningSince=Date.now();
  } else if (a.type==='save-preset') {
    if (!str(a.name,40) || !a.name.trim() || ['__proto__','constructor','prototype'].includes(a.name)) fail('Invalid preset name');
    if (Object.keys(s.presets).length>=20 && !Object.hasOwn(s.presets,a.name)) fail('Maximum 20 presets');
    s.presets[a.name]=settingsOf(s);
  } else if (a.type==='load-preset') {
    if (!Object.hasOwn(s.presets,a.name)) fail('Preset not found');
    // Identity and rating corrections are not changed by a layout preset.
    const p=upgradeStudio(upgradeBonusSettings(s.presets[a.name])); Object.assign(s,{ fields:p.fields, showAvatar:p.showAvatar, parts:p.parts, theme:p.theme, widgets:p.widgets, layoutLocked:p.layoutLocked, snap:p.snap, ticker:p.ticker,credits:p.credits,tips:p.tips,info:p.info,counters:p.counters,rss:p.rss,outputFormat:p.outputFormat,layouts:p.layouts });
  } else if (a.type==='delete-preset') { delete s.presets[a.name]; }
  else if (a.type==='import') {
    if (a.data?.version!==1) fail('Unsupported backup version');
    const imported=upgradeStudio(upgradeBonusSettings(a.data.settings));validateSettings(imported); validateSession(a.data.session); remember();
    Object.assign(s,imported); s.session=a.data.session; s.api=defaults().api;
    s.presets={};
    for (const [name,p] of Object.entries(a.data.presets || {})) {
      if (!str(name,40)||['__proto__','constructor','prototype'].includes(name)||Object.keys(s.presets).length>=20) fail('Invalid presets');
      const upgraded=upgradeStudio(upgradeBonusSettings(p));validateSettings(upgraded); s.presets[name]=upgraded;
    }
  } else if(a.type==='credits-playback') {
    if(!['play','pause','restart','stop'].includes(a.command))fail('Invalid credits command');
    s.creditsPlayback={seq:s.creditsPlayback.seq+1,command:a.command};
  } else if(a.type==='tips-playback') {
    const enabled=s.tips.items.filter(t=>t.enabled&&t.text.trim()),p=s.tipsPlayback;
    if(a.command==='pause')p.paused=true;
    else if(a.command==='play')p.paused=false;
    else if(['next','previous'].includes(a.command)){
      const current=enabled.findIndex(t=>t.id===a.currentId);p.index=nextTipIndex(current>=0?current:p.index,enabled.length,a.command==='previous'?-1:1,s.tips.order);
    }
    else fail('Invalid tips command');
    p.seq++;
  } else fail('Unknown action');
  validateSession(s.session);
  return s;
}
