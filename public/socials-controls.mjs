import {PLATFORMS} from './socials-model.mjs';
import {createMessageId} from './model.mjs';
import {createSocials,socialIconURL} from './socials-render.mjs';
export function createSocialsControls({getState,action,change,api,button,inputField}){
  const $=id=>document.getElementById(id),host=$('socials-editor'),status=$('socials-status'),preview=createSocials($('socials-preview'),{fit:false});
  let draft,baseline,dirty=false,busy=false;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const message=text=>status.textContent=text;
  const mark=()=>{dirty=true;message('Draft not saved. Save socials to publish these edits.');};
  function field(label,type,value,set,options={}){const wrap=inputField(label,type,value,v=>{set(v);mark();},options);const input=wrap.querySelector('input,select');input.oninput=input.onchange;return wrap;}
  function load(){baseline=structuredClone(getState().socials);draft=structuredClone(baseline);dirty=false;draw();message('Current socials loaded.');}
  async function upload(entry,file){
    if(!file)return;busy=true;host.disabled=true;
    try{if(file.size>200*1024)throw Error('PNG must be at most 200 KiB');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('Could not read file'));r.readAsDataURL(file);});
      const result=await api('/api/social-icons',{data});entry.icon=result.id;mark();draw();message('Icon uploaded. Save socials to publish this replacement.');
    }catch(e){message(`Upload failed: ${e.message}. Draft retained.`);}finally{busy=false;host.disabled=false;}
  }
  function draw(){
    host.replaceChildren();const options=document.createElement('div');options.className='form-grid';
    options.append(field('Display','select',draft.mode,v=>draft.mode=v,{items:[['rotate','Rotate one at a time'],['row','Static row (wraps)']]}),field('Interval (seconds)','number',draft.interval,v=>draft.interval=v,{min:5,max:300}),field('Text size','number',draft.font,v=>draft.font=v,{min:18,max:60}));host.append(options);
    draft.items.forEach((entry,i)=>{
      const card=document.createElement('section');card.className='bonus-editor-card';const controls=document.createElement('div');controls.className='button-row';
      controls.append(field('Enabled','checkbox',entry.enabled,v=>entry.enabled=v));
      for(const [label,offset] of [['Move up',-1],['Move down',1]]){const b=button(label,()=>{[draft.items[i],draft.items[i+offset]]=[draft.items[i+offset],draft.items[i]];mark();draw();});b.disabled=i+offset<0||i+offset>=draft.items.length;controls.append(b);}
      controls.append(button('Remove entry',()=>{draft.items.splice(i,1);mark();draw();}));card.append(controls);
      card.append(field('Platform','select',entry.platform,v=>{entry.platform=v;image.src=socialIconURL(entry);image.alt=PLATFORMS[v];},{items:Object.entries(PLATFORMS)}),field('Handle, display text or short URL','text',entry.text,v=>entry.text=v,{maxlength:120}),field('Call to action (optional)','text',entry.cta,v=>entry.cta=v,{maxlength:80}));
      const image=document.createElement('img');image.className='social-icon';image.src=socialIconURL(entry);image.alt=PLATFORMS[entry.platform];card.append(image);
      const label=document.createElement('label');label.textContent=entry.icon?'Replace custom PNG':'Upload custom PNG';const file=document.createElement('input');file.type='file';file.accept='image/png';file.onchange=()=>upload(entry,file.files[0]);label.append(file);card.append(label);
      if(entry.icon)card.append(button('Use platform icon',()=>{entry.icon=null;mark();draw();}));host.append(card);
    });
    const add=button('+ Add social',()=>{draft.items.push({id:createMessageId(),platform:'website',text:'',cta:'',enabled:true,icon:null});mark();draw();});add.disabled=draft.items.length>=20;host.append(add);
  }
  $('socials-save').onclick=async()=>{
    if(busy)return;busy=true;host.disabled=true;$('socials-save').disabled=true;$('socials-reload').disabled=true;
    const proposed=structuredClone(draft),expected=structuredClone(baseline);
    try{if(await action({type:'socials-edit',socials:proposed,expected})){load();message('Socials saved.');}else message('Save failed. Draft retained. If another client edited socials, reload current socials before retrying.');}
    finally{busy=false;host.disabled=false;$('socials-save').disabled=false;$('socials-reload').disabled=false;}
  };
  $('socials-reload').onclick=()=>{if(!busy)load();};
  $('socials-visible').onchange=e=>change(s=>s.widgets.socials.visible=e.target.checked);
  for(const command of ['previous','next'])$(`socials-${command}`).onclick=()=>action({type:'socials-playback',command,currentId:$('socials-preview').dataset.socialId});
  $('socials-pause').onclick=()=>action({type:'socials-playback',command:getState().socialsPlayback.paused?'play':'pause'});
  $('socials-library').onclick=async()=>{
    const library=$('socials-library-items');library.replaceChildren();
    try{const result=await api('/api/social-icons');for(const icon of result.icons){const row=document.createElement('div');row.className='button-row';const img=document.createElement('img');img.className='social-icon';img.src=socialIconURL({icon:icon.id});img.alt='Custom icon';row.append(img,button(icon.referenced?'Used by entry / preset':'Delete unused icon',async()=>{try{await api('/api/social-icons/delete',{id:icon.id});row.remove();message('Unused icon deleted.');}catch(e){message(e.message);}}));row.lastChild.disabled=icon.referenced||draft?.items.some(e=>e.icon===icon.id);library.append(row);}if(!result.icons.length)library.textContent='No uploaded icons.';}catch(e){message(e.message);}
  };
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  return {render(){const state=getState();if(!draft||!dirty&&!busy&&!same(baseline,state.socials))load();if(dirty&&!same(baseline,state.socials)&&!busy)message('Socials changed elsewhere. Your draft is retained. Reload current socials discards this draft.');$('socials-visible').checked=state.widgets.socials.visible;$('socials-pause').textContent=state.socialsPlayback.paused?'Resume':'Pause';preview.update({...state.socials,font:24},state.socialsPlayback);}};
}
