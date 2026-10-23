import { renderCanvas, tickCanvas } from './render.mjs';
const canvas=document.getElementById('overlay-canvas'), error=document.getElementById('overlay-error');
const token=new URLSearchParams(location.search).get('token'); let state;
if(!token) { error.hidden=false; error.textContent='Add the overlay URL from Pawn Control → Settings.'; }
else {
  const source=new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  source.addEventListener('state',event=>{state=JSON.parse(event.data); renderCanvas(canvas,state); error.hidden=true;});
  source.onerror=()=>{ if(!state) { error.hidden=false; error.textContent='Waiting for overlay connection. Check the URL/token and server.'; } };
  setInterval(()=>{if(state)tickCanvas(canvas,state);},1000);
}
