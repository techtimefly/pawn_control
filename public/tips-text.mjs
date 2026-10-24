import {createMessageId} from './model.mjs';

const limits={ID:80,Title:120,Category:60,Text:600};
// Quoted JSON strings preserve multiline content and significant whitespace.
const encode=value=>value.trim()!==value||/[\r\n]/.test(value)||value.startsWith('"')?JSON.stringify(value):value;
export function serializeTips(items) {
  return items.map(t=>`ID: ${encode(t.id)}\nTitle: ${encode(t.title)}\nCategory: ${encode(t.category)}\nEnabled: ${t.enabled?'yes':'no'}\nText: ${encode(t.text)}`).join('\n\n');
}
export function parseTips(source,format,existing=[],operation='replace') {
  const errors=[],items=[],seen=new Set(),byId=new Map(existing.map(t=>[t.id,t]));
  const error=(line,message)=>errors.push({line,message});
  if(!['structured','simple'].includes(format)||!['append','replace'].includes(operation))throw new Error('Unknown text mode');
  let fields={},lines={},start=1;
  function finish(){
    if(!Object.keys(fields).length)return;
    const hasId=Object.hasOwn(fields,'ID'),old=hasId?byId.get(fields.ID):null;
    if(hasId&&(!old||operation==='append'))error(lines.ID,'ID must belong to an existing tip in Replace all. Remove ID to create a new tip.');
    if(hasId&&seen.has(fields.ID))error(lines.ID,'Duplicate ID');
    if(hasId)seen.add(fields.ID);
    if(!Object.hasOwn(fields,'Text')||!fields.Text.trim())error(lines.Text||start,'Text is required and cannot be empty');
    for(const [key,max] of Object.entries(limits))if(fields[key]?.length>max)error(lines[key],`${key} exceeds ${max} characters`);
    if(Object.hasOwn(fields,'Enabled')&&!['yes','no'].includes(fields.Enabled))error(lines.Enabled,'Enabled must be yes or no');
    items.push({id:old?.id??createMessageId(),title:fields.Title??old?.title??'',category:fields.Category??old?.category??'',enabled:fields.Enabled===undefined?(old?.enabled??true):fields.Enabled==='yes',text:fields.Text??''});
    if(items.length+(operation==='append'?existing.length:0)>100)error(start,'Maximum 100 tips');
    fields={};lines={};
  }
  source.replace(/\r\n?/g,'\n').split('\n').forEach((raw,i)=>{
    const line=i+1;
    if(format==='simple'){if(raw.trim()){start=line;fields={Text:raw.trim()};lines={Text:line};finish();}return;}
    if(!raw.trim()){finish();return;}
    if(!Object.keys(fields).length)start=line;
    const match=/^\s*(ID|Title|Category|Enabled|Text):[ \t]?(.*)$/.exec(raw);
    if(!match){error(line,'Expected ID, Title, Category, Enabled, or Text followed by a colon');return;}
    const [,key,value]=match;
    if(Object.hasOwn(fields,key))error(line,`Duplicate ${key}; separate tips with a blank line`);
    let decoded=value.trim();
    if(decoded.startsWith('"')){try{decoded=JSON.parse(decoded);if(typeof decoded!=='string')throw new Error();}catch{error(line,'Invalid quoted string; use JSON escapes');decoded='';}}
    fields[key]=decoded;lines[key]=line;
  });
  finish();
  return {items,errors};
}
export const sameTips=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
