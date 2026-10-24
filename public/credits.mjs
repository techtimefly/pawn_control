import {observeViewport} from './viewport.mjs';
import {createCredits} from './bonus-render.mjs';
import {createCreditsSource} from './credits-source.mjs';
const token=new URLSearchParams(location.search).get('token'),root=document.getElementById('credits-root'),error=document.getElementById('overlay-error');
const player=createCreditsSource(createCredits(root,{autoplay:true}),window);
observeViewport(root);
const source=new EventSource(token?`/api/events?token=${encodeURIComponent(token)}`:'/api/events');
source.addEventListener('state',event=>{try{const state=JSON.parse(event.data);player.update(state.credits,state.creditsPlayback);error.hidden=true;}catch{error.hidden=false;error.textContent='Credits could not load. Update the app and refresh the source.';}});
source.onerror=()=>{if(!root.querySelector('.credits-brand')){error.hidden=false;error.textContent='Waiting for credits connection. Check the server and, when authentication is enabled, use the full credits URL.';}};

