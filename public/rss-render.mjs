// Refresh only updates the pending list. Current story and elapsed time survive
// arrivals, reordering and SSE updates until the display boundary (or Skip/Pin).
export class StoryClock {
  constructor(){this.current=null;this.pending=[];this.elapsed=0;this.last=null;this.seq=null;this.paused=false;this.pinned=null;}
  update(output,now){this.tick(now);this.pending=output.items;this.paused=output.paused;this.pinned=output.pinned;
    if(this.seq!==null&&this.seq!==output.seq)this.advance();this.seq=output.seq;
    if(!this.current)this.advance();
  }
  tick(now){if(this.last!==null&&!this.paused)this.elapsed+=Math.max(0,now-this.last);this.last=now;}
  advance(){const pinned=this.pending.find(x=>x.id===this.pinned),index=this.pending.findIndex(x=>x.id===this.current?.id);this.current=pinned||this.pending[(index+1)%this.pending.length]||null;this.elapsed=0;}
}
export function createRSS(wrapper){
  const surface=document.createElement('div'),tag=document.createElement('span'),viewport=document.createElement('div'),line=document.createElement('span');
  surface.className='ticker-surface';tag.className='ticker-tag';viewport.className='ticker-window';line.className='ticker-line';tag.textContent='NEWS';viewport.append(line);surface.append(tag,viewport);wrapper.append(surface);
  const clock=new StoryClock();let options,shown;
  function draw(now){if(!wrapper.isConnected)return;clock.tick(now);
    if(options){const duration=options.mode==='rotate'?options.interval*1000:(viewport.clientWidth+line.offsetWidth)/options.speed*1000+options.pause*1000;
      if(!clock.paused&&clock.elapsed>=duration)clock.advance();
      const current=clock.current,text=current?`${current.title} — ${current.source}${options.showTime&&current.publishedAt?' · '+new Date(current.publishedAt).toLocaleString():''}`:'';
      if(shown!==text){line.textContent=text;shown=text;}surface.hidden=!current;
      line.style.transform=options.mode==='rotate'?'none':`translateX(${options.direction==='right'?-line.offsetWidth+clock.elapsed/1000*options.speed:viewport.clientWidth-clock.elapsed/1000*options.speed}px)`;
    }requestAnimationFrame(draw);
  }requestAnimationFrame(draw);
  return {update(output,nextOptions,background){options=nextOptions;surface.style.background=background;surface.style.fontSize=`${options.font}px`;clock.update(output,performance.now());}};
}
