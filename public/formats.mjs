export const FORMATS=Object.freeze({landscape:{label:'Landscape',width:2560,height:1440},vertical:{label:'Vertical',width:1080,height:1920}});
export const canvasSize=s=>FORMATS[s.outputFormat||'landscape'];
// Purpose-built portrait positions, not a scaled copy of the landscape canvas.
export function verticalLayout(widgets){
  const positions={stats:[40,60,1000,450],scoreboard:[40,540,1000,180],info:[40,760,1000,200],counters:[40,1000,1000,200],tips:[40,1240,1000,330],credits:[0,0,1080,1920],rss:[40,1640,1000,90],ticker:[40,1770,1000,110]};
  return Object.fromEntries(Object.entries(widgets).map(([id,w])=>{const [x,y,width,height]=positions[id]||[40,60,1000,200];return [id,{...w,x,y,w:width,h:height}];}));
}
export function upgradeFormats(s){
  const outputFormat=s.outputFormat??'landscape',widgets=structuredClone(s.widgets);
  const layouts={landscape:structuredClone(s.layouts?.landscape??widgets),vertical:structuredClone(s.layouts?.vertical??verticalLayout(widgets))};
  layouts[outputFormat]=widgets;
  return {...s,outputFormat,layouts,widgets};
}
export function formatSettings(s,patch){
  const next={...s,...patch},layouts=structuredClone(patch.layouts??s.layouts);
  // Save the current arrangement before selecting another independent layout.
  if(next.outputFormat!==s.outputFormat){layouts[s.outputFormat]=structuredClone(s.widgets);next.widgets=structuredClone(layouts[next.outputFormat]);}
  else layouts[next.outputFormat]=structuredClone(next.widgets);
  return {...next,layouts};
}
