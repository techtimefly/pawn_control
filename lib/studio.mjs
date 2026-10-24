import {randomUUID} from 'node:crypto';
import {defaults,newSession} from '../public/model.mjs';
import {upgradeStudio} from '../public/studio-model.mjs';
import {applyAction,settingsOf,validateSettings} from './state.mjs';
const clone=structuredClone;
const prune=(value,shape)=>Array.isArray(shape)?(shape.length?value.map(x=>prune(x,shape[0])):[]):shape&&typeof shape==='object'?Object.fromEntries(Object.keys(shape).map(k=>[k,prune(value[k],shape[k])])):value;
const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>80)throw Error('Name must be 1–80 characters');return v.trim();};
export function migrateStudio(state) {
  const s=upgradeStudio(state),profileId=randomUUID(),showId=randomUUID();
  return {version:2,selected:{profileId,showId},profiles:[{id:profileId,name:'Original brand',brand:{username:s.username,channel:s.channel,theme:clone(s.theme)},shows:[{id:showId,name:'Original show',state:s}]}],published:{profileId,showId,name:'Original brand / Original show',state:clone(s)},rssRuntime:{items:[],status:{},paused:false,pinned:null,seq:0}};
}
export function selected(studio) {
  const profile=studio.profiles.find(p=>p.id===studio.selected.profileId),show=profile?.shows.find(s=>s.id===studio.selected.showId);
  if(!show)throw Error('Show not found');return {profile,show};
}
export function editorState(studio) {
  const {profile,show}=selected(studio);return {...clone(show.state),...clone(profile.brand)};
}
export function setEditor(studio,state) {
  const {profile,show}=selected(studio);
  if(profile.brand.username!==state.username)for(const other of profile.shows){other.state.api=defaults().api;other.state.session.baseline={};}
  show.state=clone(state);profile.brand={username:state.username,channel:state.channel,theme:clone(state.theme)};
}
export const LIVE_ACTIONS=new Set(['record','decrement','totals','edit-result','delete-result','reset','undo','timer','credits-playback','tips-playback','counter-live','ticker-live']);
export function editStudio(original,action) {
  const s=clone(original);
  if(LIVE_ACTIONS.has(action.type)) {
    s.published.state=applyAction(s.published.state,action);
    const p=s.profiles.find(p=>p.id===s.published.profileId),show=p.shows.find(x=>x.id===s.published.showId);
    for(const key of ['session','undo','creditsPlayback','tipsPlayback'])show.state[key]=clone(s.published.state[key]);
    if(action.type==='counter-live')for(const c of show.state.counters){const live=s.published.state.counters.find(x=>x.id===c.id);if(live)c.value=live.value;}
    if(action.type==='ticker-live')show.state.ticker.paused=s.published.state.ticker.paused;
  } else {
    const before=editorState(s),next=applyAction(before,action);
    // Counter values are runtime controls, not editable layout/content fields.
    if(action.type==='settings')for(const counter of next.counters){const previous=before.counters.find(c=>c.id===counter.id);if(previous)counter.value=previous.value;}
    setEditor(s,next);
  }
  return s;
}
export function genericState() {
  const s=defaults();s.username='';s.channel='';s.widgets.stats.visible=false;s.widgets.ticker.visible=false;
  s.ticker.messages=[];s.credits.brand='Your brand';s.credits.subtitle='Your show';s.credits.sections=[];s.tips.items=[];
  s.layouts.landscape=clone(s.widgets);s.layouts.vertical.stats.visible=false;s.layouts.vertical.ticker.visible=false;return s;
}
export function studioAction(original,a) {
  const s=clone(original),{profile,show}=selected(s);
  if(a.type==='select') {s.selected={profileId:a.profileId,showId:a.showId};selected(s);}
  else if(a.type==='create-profile'||a.type==='duplicate-profile') {
    if(s.profiles.length>=20)throw Error('Maximum 20 profiles');
    const id=randomUUID(),state=a.type==='duplicate-profile'?editorState(s):genericState();
    const shows=a.type==='duplicate-profile'?profile.shows.map(x=>({id:randomUUID(),name:x.name,state:clone(x.state)})):[{id:randomUUID(),name:'Untitled show',state}];
    for(const x of shows){x.state.session=newSession();x.state.undo=[];x.state.api=defaults().api;x.state.counters=x.state.counters.map(c=>({...c,value:0}));}
    s.profiles.push({id,name:name(a.name),brand:{username:state.username,channel:state.channel,theme:clone(state.theme)},shows});s.selected={profileId:id,showId:shows[0].id};
  } else if(a.type==='create-show'||a.type==='duplicate-show') {
    if(profile.shows.length>=20)throw Error('Maximum 20 shows per profile');
    const state=a.type==='duplicate-show'?editorState(s):genericState();state.session=newSession();state.undo=[];state.api=defaults().api;state.counters=state.counters.map(c=>({...c,value:0}));
    const id=randomUUID();profile.shows.push({id,name:name(a.name),state});s.selected.showId=id;
  } else if(a.type==='rename-profile')profile.name=name(a.name);
  else if(a.type==='rename-show')show.name=name(a.name);
  else if(a.type==='take-live') {
    if(a.profileId&&a.profileId!==profile.id||a.showId&&a.showId!==show.id)throw Error('Editor selection changed; review the selected show before Take Live');
    s.rssRuntimes??={};s.rssRuntimes[s.published.showId]=clone(s.rssRuntime);
    s.published={profileId:profile.id,showId:show.id,name:`${profile.name} / ${show.name}`,state:editorState(s)};
    if(original.published.showId!==show.id)s.rssRuntime=s.rssRuntimes[show.id]||{items:[],status:{},paused:false,pinned:null,seq:0};
    s.rssRuntime.seq=(original.rssRuntime.seq||0)+1;
  } else if(a.type==='import-template') {
    if(a.data?.kind!=='pawn-control-template'||a.data.version!==1||!Array.isArray(a.data.shows)||!a.data.shows.length||a.data.shows.length>20||s.profiles.length>=20)throw Error('Invalid template');
    const shows=a.data.shows.map(x=>{const settings=upgradeStudio(x.settings);validateSettings(settings);const state={...genericState(),...prune(settings,settingsOf(defaults()))};state.rss.feeds=[];state.counters=state.counters.map(c=>({...c,value:0}));return {id:randomUUID(),name:name(x.name),state};});
    const state=shows[0].state,id=randomUUID();s.profiles.push({id,name:name(a.data.name),brand:{username:state.username,channel:state.channel,theme:clone(state.theme)},shows});s.selected={profileId:id,showId:shows[0].id};
  } else throw Error('Unknown studio action');
  return s;
}
// Conservative portable export: all free-form personal content becomes placeholders.
// Backup export remains the separate way to preserve exact private content/session data.
export function exportTemplate(studio) {
  const {profile}=selected(studio);
  return {kind:'pawn-control-template',version:1,name:'Your brand',shows:profile.shows.map((show,i)=>{
    const s=settingsOf({...show.state,...profile.brand});s.username='';s.channel='';s.overrides={blitz:null,rapid:null,bullet:null};
    s.info={title:'Your headline',text:'Your information'};s.counters=s.counters.map((c,i)=>({id:`counter-${i}`,label:'Your counter',value:0}));
    s.ticker.messages=s.ticker.messages.map((m,i)=>({id:`message-${i}`,text:'Your announcement',enabled:m.enabled}));
    s.credits.brand='Your brand';s.credits.subtitle='Your show';s.credits.final='Thank you';s.credits.sections=s.credits.sections.map((x,i)=>({id:`section-${i}`,title:'Your section',enabled:x.enabled,entries:x.entries.map((e,j)=>({id:`entry-${j}`,label:'Your credit',detail:'Your detail',enabled:e.enabled}))}));
    s.tips.items=s.tips.items.map((t,i)=>({id:`tip-${i}`,title:'Your title',category:'Your category',text:'Your message',enabled:t.enabled}));
    s.rss.feeds=[];s.rss.keywords='';s.ticker.separator=' • ';s.rss.separator=' • ';
    return {name:`Show ${i+1}`,settings:prune(s,settingsOf(defaults()))};
  })};
}
