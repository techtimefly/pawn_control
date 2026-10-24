import {createCredits} from './bonus-render.mjs';
import {createCreditsSource} from './credits-source.mjs';
import {canvasSize} from './formats.mjs';
const token=new URLSearchParams(location.search).get('token'),root=document.getElementById('credits-root'),error=document.getElementById('overlay-error');
const player=createCreditsSource(createCredits(root,{autoplay:true}),window);
if(!token){error.hidden=false;error.textContent='Copy the full credits URL from Settings.';}
else {
  const source=new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  source.addEventListener('state',event=>{try{const state=JSON.parse(event.data),{width,height}=canvasSize(state);root.style.width=`${width}px`;root.style.height=`${height}px`;player.update(state.credits,state.creditsPlayback);error.hidden=true;}catch{error.hidden=false;error.textContent='Credits could not load. Update the app and refresh the source.';}});
  source.onerror=()=>{if(!root.querySelector('.credits-brand')){error.hidden=false;error.textContent='Waiting for credits connection. Check URL/token.';}};
}
