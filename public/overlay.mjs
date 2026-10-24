import {observeViewport} from './viewport.mjs';
import { renderCanvas, tickCanvas } from './render.mjs';
const canvas=document.getElementById('overlay-canvas'), error=document.getElementById('overlay-error');
const token=new URLSearchParams(location.search).get('token'); let state;
observeViewport(canvas);
const source=new EventSource(token?`/api/events?token=${encodeURIComponent(token)}`:'/api/events');
source.addEventListener('state',event=>{state=JSON.parse(event.data); renderCanvas(canvas,state); error.hidden=true;});
source.onerror=()=>{ if(!state) { error.hidden=false; error.textContent='Waiting for overlay connection. Check the server and, when authentication is enabled, use the URL from Settings.'; } };
setInterval(()=>{if(state)tickCanvas(canvas,state);},1000);

