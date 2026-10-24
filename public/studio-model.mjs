export const EXTRA_WIDGETS = ['info','counters','rss'];
export function studioDefaults() {
  const widget=(y,h)=>({x:70,y,w:900,h,scale:1,visible:false,locked:false,z:4});
  return {widgets:{info:widget(100,200),counters:widget(320,150),rss:widget(1250,70)},
    info:{title:'Your headline',text:'Your information'}, counters:[{id:'count',label:'Count',value:0}],
    rss:{feeds:[],keywords:'',maxAgeHours:48,approval:true,showTime:false,mode:'rotate',interval:15,speed:100,gap:40,pause:2,direction:'left',paused:false,font:28,opacity:95,separator:' • '}};
}
export function upgradeStudio(s) {
  const d=studioDefaults();return {...s,widgets:{...d.widgets,...s.widgets},info:s.info??d.info,counters:s.counters??d.counters,rss:{...d.rss,...s.rss}};
}
