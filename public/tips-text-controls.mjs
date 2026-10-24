import {parseTips,serializeTips,sameTips} from './tips-text.mjs';

export function createTipsTextControls({getState,action,confirmChange}) {
  const $=id=>document.getElementById(id),host=$('tips-text-editor');
  let baseline=[],preview=null,undo=null,busy=false,dirty=false;
  const invalidate=()=>{preview=null;$('tips-text-apply').disabled=true;$('tips-text-results').replaceChildren();};
  const message=text=>{$('tips-text-status').textContent=text;};
  function load(){baseline=structuredClone(getState().tips.items);$('tips-text-source').value=$('tips-text-format').value==='structured'?serializeTips(baseline):'';dirty=false;invalidate();message('Draft loaded. Preview before applying.');}
  $('tips-text-toggle').onclick=async()=>{
    if(!host.hidden&&dirty&&!await confirmChange('Discard unapplied text edits and return to the visual editor?'))return;
    host.hidden=!host.hidden;$('tips-items').hidden=!host.hidden;$('tips-add').hidden=!host.hidden;
    $('tips-text-toggle').textContent=host.hidden?'Advanced text mode':'Visual editor';
    if(!host.hidden)load();else dirty=false;
  };
  let format='structured';
  $('tips-text-format').onchange=async()=>{
    if(!await confirmChange('Changing format starts a fresh draft. Simple list cannot preserve titles, categories, enabled flags or IDs. Continue?')){$('tips-text-format').value=format;return;}
    format=$('tips-text-format').value;load();
  };
  $('tips-text-source').oninput=()=>{dirty=true;invalidate();};
  $('tips-text-operation').onchange=invalidate;
  $('tips-text-reload').onclick=async()=>{if(!dirty||await confirmChange('Discard this draft and reload current tips?'))load();};
  $('tips-text-preview').onclick=()=>{
    invalidate();const current=getState().tips.items;
    if(!sameTips(current,baseline)){message('Tips changed elsewhere. Your draft is retained. Copy it if needed, then reload current tips before applying.');return;}
    const operation=$('tips-text-operation').value,result=parseTips($('tips-text-source').value,format,baseline,operation);
    const output=$('tips-text-results');
    if(result.errors.length){message('Fix the following errors:');for(const error of result.errors){const p=document.createElement('p');p.textContent=`Line ${error.line}: ${error.message}`;output.append(p);}return;}
    const items=operation==='append'?[...baseline,...result.items]:result.items;
    preview={items,operation};
    message(`${operation==='append'?'Append':'Replace all'}: ${result.items.length} draft tips; ${items.length} total after applying.`);
    for(const tip of items){const p=document.createElement('p');p.className='tips-text-preview-item';p.textContent=`${tip.enabled?'Enabled':'Disabled'} · ${tip.title||'(No title)'} · ${tip.category||'(No category)'}\n${tip.text}`;output.append(p);}
    $('tips-text-apply').disabled=false;
  };
  async function save(items,expected){
    busy=true;for(const id of ['toggle','source','format','operation','reload','preview','apply','undo'])$(`tips-text-${id}`).disabled=true;
    try{return await action({type:'tips-items',items,expectedItems:expected});}
    finally{busy=false;for(const id of ['toggle','source','format','operation','reload','preview'])$(`tips-text-${id}`).disabled=false;}
  }
  $('tips-text-apply').onclick=async()=>{
    if(!preview||busy)return;
    const proposed=preview;
    if(proposed.operation==='replace'&&!await confirmChange(`Replace all ${baseline.length} saved tips with ${proposed.items.length} tips? Simple-list replacements create new tips without previous metadata. Undo is available until you leave this page, provided tips have not changed again.`))return;
    const before=structuredClone(baseline);
    const ok=await save(proposed.items,before);
    if(ok){undo={before,after:structuredClone(proposed.items)};load();message('Applied. Undo is available below.');}
    else message('Not applied. Draft retained; tips may have changed elsewhere. Reload before retrying.');
    $('tips-text-undo').disabled=!undo;
  };
  $('tips-text-undo').onclick=async()=>{
    if(!undo||busy)return;
    if(dirty&&!await confirmChange('Undo will discard your current draft. Continue?'))return;
    if(await save(undo.before,undo.after)){undo=null;load();message('Previous tips restored.');}
    else message('Undo could not apply: saved tips changed. No newer tips were overwritten.');
    $('tips-text-undo').disabled=!undo;
  };
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  return {update(){if(!host.hidden&&!sameTips(getState().tips.items,baseline)&&!busy){invalidate();message('Tips changed elsewhere. Your draft is retained; reload before applying.');}},async canLeave(){return !busy&&(!dirty||await confirmChange('Leave this tab? Your text draft will remain here until you return; leaving the page discards it.'));}};
}
