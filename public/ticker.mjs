// A clock independent of renders: API updates must not restart message rotation.
export class TickerClock {
  constructor(now=0) { this.elapsed=0; this.last=now; this.paused=false; }
  update(now,paused=this.paused) {
    if(!this.paused)this.elapsed+=Math.max(0,now-this.last);
    this.last=now;this.paused=paused;return this.elapsed;
  }
}
export function rotationIndex(ms,interval,count) { return count ? Math.floor(ms/(Math.max(1,interval)*1000))%count : 0; }
export function scrollOffset(ms,width,speed,pause,direction) {
  if(width<=0)return 0;
  const travel=width/Math.max(1,speed)*1000, hold=Math.max(0,pause)*1000;
  const phase=ms%(travel+hold),distance=Math.min(width,phase/1000*speed);
  return (direction==='right' ? -width+distance : -distance) || 0;
}
const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!=null)node.textContent=text;return node;};
export function createTicker(wrapper) {
  wrapper.replaceChildren();
  const surface=make('div','ticker-surface'),tag=make('span','ticker-tag'),viewport=make('div','ticker-window'),line=make('span','ticker-line');
  viewport.append(line);surface.append(tag,viewport);wrapper.append(surface);
  let clock=new TickerClock(performance.now()),mode,options,messages=[],contentKey='',width=0,needsMeasure=true,index=-1;
  function buildScroll() {
    line.replaceChildren();line.classList.remove('ticker-rotation');
    const group=make('span','ticker-group');
    for(const message of messages) {
      group.append(make('span','ticker-message',message));
      const separator=make('span','ticker-separator',options.separator);separator.style.margin=`0 ${options.gap}px`;group.append(separator);
    }
    line.append(group);width=0;needsMeasure=true;
  }
  const observer=new ResizeObserver(()=>{needsMeasure=true;});observer.observe(viewport);
  function draw(now) {
    if(!wrapper.isConnected) { observer.disconnect();return; }
    const ms=clock.update(now);
    if(messages.length && options) {
      if(mode==='rotate') {
        const next=rotationIndex(ms,options.interval,messages.length);
        if(next!==index) { index=next;line.textContent=messages[index]; }
      } else {
        if(needsMeasure && viewport.clientWidth>0) {
          // Repeat short sets until they fill the viewport, then duplicate the
          // complete group so either direction always has visible content.
          const group=line.firstElementChild;
          while(line.children.length>1)line.lastElementChild.remove();
          const unit=group.cloneNode(true);group.replaceChildren(...unit.childNodes);
          // offsetWidth is unscaled, unlike the layout editor's transformed rect.
          const natural=group.offsetWidth;
          if(natural>0) {
            const repeat=Math.min(100,Math.max(1,Math.ceil(viewport.clientWidth/natural)));
            for(let i=1;i<repeat;i++)for(const child of [...unit.childNodes])group.append(child.cloneNode(true));
            width=group.offsetWidth;line.append(group.cloneNode(true));needsMeasure=false;
          }
        }
        line.style.transform=`translateX(${scrollOffset(ms,width,options.speed,options.pause,options.direction)}px)`;
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return { update(nextMessages,nextOptions,channel,background) {
    const now=performance.now();clock.update(now,nextOptions.paused);
    if(mode!==nextOptions.mode) {mode=nextOptions.mode;clock=new TickerClock(now);clock.paused=nextOptions.paused;contentKey='';}
    options=nextOptions;messages=nextMessages;
    surface.style.background=background;surface.style.fontSize=`${options.font}px`;tag.textContent=channel.toUpperCase();
    surface.hidden=!messages.length;
    const key=JSON.stringify([messages,options.gap,options.separator,options.font]);
    if(contentKey!==key) {
      contentKey=key;index=-1;
      if(mode==='scroll')buildScroll();
      else {line.replaceChildren();line.classList.add('ticker-rotation');line.style.transform='none';index=rotationIndex(clock.elapsed,options.interval,messages.length);line.textContent=messages[index]||'';}
    }
  }};
}
