import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTips,serializeTips} from '../public/tips-text.mjs';
import {defaults} from '../public/model.mjs';
import {applyAction} from '../lib/state.mjs';
import {createTipsTextControls} from '../public/tips-text-controls.mjs';
import {createTips} from '../public/bonus-render.mjs';

test('structured round trip preserves identity, order, duplicate content and exact metadata',()=>{
  const items=[{id:'a',title:'  â™ž: title  ',category:'"quoted"',enabled:false,text:'First: line\r\n\nSecond <b>plain</b>'},{id:'b',title:'',category:'',enabled:true,text:'First: line\r\n\nSecond <b>plain</b>'}];
  for(const source of [serializeTips(items),serializeTips(items).replaceAll('\n','\r\n')]){
    const result=parseTips(source,'structured',items);assert.deepEqual(result.errors,[]);assert.deepEqual(result.items,items);
  }
  const reordered=parseTips(serializeTips([...items].reverse()),'structured',items);assert.deepEqual(reordered.items,[...items].reverse());
  const edited=parseTips('ID: a\nText: Changed','structured',items).items[0];assert.deepEqual(edited,{...items[0],text:'Changed'});
});
test('new entries, simple lines, whitespace, Unicode and colons',()=>{
  const result=parseTips(' \r\n Text: â™ž Threats: check\r\n\r\nText: â™ž Threats: check','structured');
  assert.deepEqual(result.errors,[]);assert.equal(result.items.length,2);assert.notEqual(result.items[0].id,result.items[1].id);assert.equal(result.items[0].enabled,true);assert.equal(result.items[0].title,'');
  const simple=parseTips('  One: â™Ÿ \r\n\nTwo\n','simple');assert.deepEqual(simple.items.map(t=>t.text),['One: â™Ÿ','Two']);
});
test('line-specific validation catches unknown/duplicate fields, enabled, missing/empty text, IDs and quotes',()=>{
  for(const [source,line] of [['Wrong: value\nText: ok',1],['Text: ok\nEnabled: true',2],['Title: only',1],['Text:   ',1],['Text: ok\nText: two',2],['ID: unknown\nText: ok',1],['Text: "unterminated',1]])assert.ok(parseTips(source,'structured').errors.some(e=>e.line===line),source);
  const items=defaults().tips.items;
  assert.ok(parseTips(serializeTips([items[0],items[0]]),'structured',items).errors.some(e=>e.message==='Duplicate ID'));
  assert.ok(parseTips(serializeTips(items),'structured',items,'append').errors.length);
});
test('all text/item limits include existing tips for append',()=>{
  for(const [key,max] of [['Title',120],['Category',60],['Text',600]]){
    const source=n=>`${key}: ${'x'.repeat(n)}${key==='Text'?'':'\nText: valid'}`;
    assert.equal(parseTips(source(max),'structured').errors.length,0);assert.ok(parseTips(source(max+1),'structured').errors.length);
  }
  assert.equal(parseTips(Array(100).fill('tip').join('\n'),'simple').errors.length,0);
  assert.ok(parseTips(Array(101).fill('tip').join('\n'),'simple').errors.length);
  assert.ok(parseTips(Array(98).fill('tip').join('\n'),'simple',defaults().tips.items,'append').errors.length);
});
test('atomic append/replace/undo preserves playback and settings; stale changes and invalid API input rejected',()=>{
  const before=defaults(),items=before.tips.items,playback=structuredClone(before.tipsPlayback);
  const added=parseTips('More advice','simple').items;
  let s=applyAction(before,{type:'tips-items',expectedItems:items,items:[...items,...added]});
  assert.deepEqual(s.tipsPlayback,playback);assert.equal(s.tips.interval,before.tips.interval);
  assert.throws(()=>applyAction(s,{type:'tips-items',expectedItems:items,items:[]}),/changed elsewhere/);
  s=applyAction(s,{type:'tips-items',expectedItems:s.tips.items,items});assert.deepEqual(s.tips,before.tips);
  assert.throws(()=>applyAction(s,{type:'tips-items',expectedItems:items,items:[{...items[0],text:'x'.repeat(601)}]}),/chess tip/);
  assert.throws(()=>applyAction(s,{type:'tips-items',expectedItems:items,items:Array(101).fill(items[0])}),/tips/);
  s=applyAction(s,{type:'tips-playback',command:'next',currentId:items[0].id});assert.equal(s.tipsPlayback.index,1);
  s=applyAction(s,{type:'tips-items',expectedItems:items,items:[]});assert.deepEqual(s.tips.items,[]);
});

// Exercise the real editor event handlers with a small DOM fixture, without a browser dependency.
function fixture(t){
  const previous={document:globalThis.document,window:globalThis.window,confirm:globalThis.confirm};
  const element=()=>({hidden:false,disabled:false,value:'',textContent:'',children:[],append(x){this.children.push(x);},replaceChildren(){this.children=[];}});
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const events={};globalThis.document={getElementById:get,createElement:element};globalThis.window={addEventListener:(type,fn)=>events[type]=fn};globalThis.confirm=()=>true;
  t.after(()=>Object.assign(globalThis,previous));
  get('tips-text-editor').hidden=true;get('tips-text-format').value='structured';get('tips-text-operation').value='replace';
  let state=defaults(),fail=false;
  const controls=createTipsTextControls({getState:()=>state,confirmChange:async message=>globalThis.confirm(message),action:async a=>{if(fail)return false;try{state=applyAction(state,a);controls.update();return true;}catch{return false;}}});
  const click=id=>get(`tips-text-${id}`).onclick();
  return {get,events,controls,click,state:()=>state,fail:()=>fail=true};
}
test('editor requires preview, retains dirty drafts across realtime updates and cancels format/navigation changes',async t=>{
  const f=fixture(t);await f.click('toggle');const source=f.get('tips-text-source');source.value='Text: My draft';source.oninput();
  let prevented=false;f.events.beforeunload({preventDefault(){prevented=true;}});assert.ok(prevented);
  globalThis.confirm=()=>false;f.get('tips-text-format').value='simple';await f.get('tips-text-format').onchange();assert.equal(f.get('tips-text-format').value,'structured');assert.equal(await f.controls.canLeave(),false);
  await f.click('toggle');assert.equal(f.get('tips-text-editor').hidden,false);
  f.state().tips.items[0].text='Remote edit';f.controls.update();assert.equal(source.value,'Text: My draft');f.click('preview');assert.equal(f.get('tips-text-apply').disabled,true);assert.match(f.get('tips-text-status').textContent,/changed elsewhere/);
});
test('editor append, replacement confirmation, successful undo and failed save retain correct state',async t=>{
  const f=fixture(t);await f.click('toggle');const original=structuredClone(f.state().tips.items),source=f.get('tips-text-source');source.value='Text: New';source.oninput();
  f.get('tips-text-operation').value='append';f.click('preview');await f.click('apply');assert.equal(f.state().tips.items.length,4);
  await f.click('undo');assert.deepEqual(f.state().tips.items,original);
  source.value='Text: Replacement';source.oninput();f.get('tips-text-operation').value='replace';f.click('preview');globalThis.confirm=()=>false;await f.click('apply');assert.deepEqual(f.state().tips.items,original);
  globalThis.confirm=()=>true;f.fail();await f.click('apply');assert.equal(source.value,'Text: Replacement');assert.deepEqual(f.state().tips.items,original);
});
test('renderer retains the current identity across structured edits and respects playback commands',t=>{
  const oldDocument=globalThis.document,oldFrame=globalThis.requestAnimationFrame;
  const element=()=>({classList:{add(){}},style:{},dataset:{},replaceChildren(){},textContent:''});
  globalThis.document={createElement:element};globalThis.requestAnimationFrame=()=>{};
  t.after(()=>{globalThis.document=oldDocument;globalThis.requestAnimationFrame=oldFrame;});
  const s=defaults(),root=element(),renderer=createTips(root);
  renderer.update(s.tips,{seq:0,index:1,paused:true});assert.equal(root.dataset.tipId,'develop');
  const result=parseTips(serializeTips([...s.tips.items].reverse()),'structured',s.tips.items);
  renderer.update({...s.tips,items:result.items},{seq:0,index:1,paused:true});assert.equal(root.dataset.tipId,'develop');
  renderer.update({...s.tips,items:result.items},{seq:1,index:2,paused:false});assert.equal(root.dataset.tipId,'threats');
});
