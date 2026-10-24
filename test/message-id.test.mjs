import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createMessageId,defaults} from '../public/model.mjs';
import {applyAction,settingsOf} from '../lib/state.mjs';
test('uses native UUID when available',()=>assert.equal(createMessageId({randomUUID:()=> 'native-id'}),'native-id'));
test('plain HTTP crypto without randomUUID uses getRandomValues',()=>{
  const id=createMessageId({getRandomValues:bytes=>bytes.fill(42)});
  assert.equal(id,'cta-'+'2a'.repeat(16));
});
test('CTA creation and persistence work without browser crypto',()=>{
  const s=defaults(),settings=settingsOf(s),ids=new Set();
  for(let i=0;i<30;i++)ids.add(createMessageId(null));
  assert.equal(ids.size,30);
  for(const id of [...ids].slice(0,3))settings.ticker.messages.push({id,text:'Follow {channel}!',enabled:true});
  const next=applyAction(s,{type:'settings',settings});
  assert.equal(next.ticker.messages.length,7);
});
