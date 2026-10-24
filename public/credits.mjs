import {createCredits} from './bonus-render.mjs';
const token=new URLSearchParams(location.search).get('token'),root=document.getElementById('credits-root'),error=document.getElementById('overlay-error');
const player=createCredits(root,{autoplay:true});
if(!token){error.hidden=false;error.textContent='Copy the full credits URL from Settings.';}
else {
  const source=new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  source.addEventListener('state',event=>{try{const state=JSON.parse(event.data);player.update(state.credits,state.creditsPlayback);error.hidden=true;}catch{error.hidden=false;error.textContent='Credits could not load. Update the app and refresh the source.';}});
  source.onerror=()=>{if(!root.querySelector('.credits-brand')){error.hidden=false;error.textContent='Waiting for credits connection. Check URL/token.';}};
}
