import { randomUUID } from 'node:crypto';
import { defaults, totals, newSession, rating, MODES, FIELDS } from '../public/model.mjs';
const fail = message => { throw new Error(message); };
const obj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = (v,min,max) => Number.isFinite(v) && v >= min && v <= max;
const str = (v,max) => typeof v === 'string' && v.length <= max;
export function validateSettings(s) {
  if (!obj(s)) fail('Invalid settings');
  if (Object.keys(s).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
  if (!/^[a-zA-Z0-9_-]{2,50}$/.test(s.username) || !/^[a-zA-Z0-9_]{2,30}$/.test(s.channel)) fail('Invalid player or channel');
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
  for (const id of ['stats','scoreboard','ticker']) {
    const w = s.widgets?.[id];
    if (!obj(w) || !num(w.x,0,2560) || !num(w.y,0,1440) || !num(w.w,150,2560) || !num(w.h,40,1440) || w.x+w.w>2560.1 || w.y+w.h>1440.1 || !num(w.scale,0.5,2) || !Number.isInteger(w.z) || !num(w.z,0,50) || typeof w.visible !== 'boolean' || typeof w.locked !== 'boolean') fail('Widget must fit the canvas');
  }
  const t=s.ticker;
  if (!obj(t) || !['scroll','rotate'].includes(t.mode) || !num(t.interval,5,300) || !num(t.speed,20,300) || !num(t.gap,0,300) || !num(t.pause,0,30) || !num(t.font,18,60) || !num(t.opacity,0,100) || !['left','right'].includes(t.direction) || typeof t.paused !== 'boolean' || !str(t.separator,12)) fail('Invalid ticker settings');
  if (!Array.isArray(t.messages) || t.messages.length>50 || new Set(t.messages.map(m=>m.id)).size!==t.messages.length || t.messages.some(m=>!str(m.id,80) || !str(m.text,500) || typeof m.enabled!=='boolean')) fail('Invalid ticker messages');
  return s;
}
export const SETTING_KEYS = ['username','channel','activeMode','showAvatar','fields','parts','goals','overrides','theme','widgets','layoutLocked','snap','ticker'];
export function settingsOf(state) { return Object.fromEntries(SETTING_KEYS.map(k=>[k,structuredClone(state[k])])); }
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
  if (a.type==='settings') {
    if (!obj(a.settings) || Object.keys(a.settings).some(k=>!SETTING_KEYS.includes(k))) fail('Unknown setting');
    const merged={...settingsOf(s),...a.settings}; validateSettings(merged);
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
    const p=s.presets[a.name]; Object.assign(s,{ fields:p.fields, showAvatar:p.showAvatar, parts:p.parts, theme:p.theme, widgets:p.widgets, layoutLocked:p.layoutLocked, snap:p.snap, ticker:p.ticker });
  } else if (a.type==='delete-preset') { delete s.presets[a.name]; }
  else if (a.type==='import') {
    if (a.data?.version!==1) fail('Unsupported backup version');
    validateSettings(a.data.settings); validateSession(a.data.session); remember();
    Object.assign(s,a.data.settings); s.session=a.data.session; s.api=defaults().api;
    s.presets={};
    for (const [name,p] of Object.entries(a.data.presets || {})) {
      if (!str(name,40)||['__proto__','constructor','prototype'].includes(name)||Object.keys(s.presets).length>=20) fail('Invalid presets');
      validateSettings(p); s.presets[name]=p;
    }
  } else fail('Unknown action');
  validateSession(s.session);
  return s;
}
