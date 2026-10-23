import { FIELDS, rating, totals, streaks, elapsed, clock, tickerMessages, historyStats } from './model.mjs';
export const el=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; };
const rgba=(hex,opacity)=>`${hex}${Math.round(opacity/100*255).toString(16).padStart(2,'0')}`;
export function statValues(s) {
  const t=totals(s.session), count=t.win+t.loss+t.draw, streak=streaks(s.session), r=rating(s,s.activeMode), baseline=s.session.baseline[s.activeMode], h=historyStats(s);
  return {
    username:s.username, blitz:rating(s,'blitz')??'Unrated', rapid:rating(s,'rapid')??'Unrated', bullet:rating(s,'bullet')??'Unrated',
    session:['win','loss','draw'].filter(k=>s.parts[k]).map(k=>`${t[k]}${k==='win'?'W':k==='loss'?'L':'D'}`).join(' · ') || '—',
    streak:streak.label, bestStreak:`${streak.best}W`, winRate:count?`${Math.round(t.win/count*100)}%`:'—',
    delta:r!=null&&baseline!=null?`${r-baseline>=0?'+':''}${r-baseline} ${s.activeMode}`:'—',
    best:s.api.stats?.[`chess_${s.activeMode}`]?.best?.rating??'—', goal:r!=null?`${r} / ${s.goals[s.activeMode]}`:'—',
    recent:s.session.results.slice(-10).map(r=>r.result==='win'?'W':r.result==='loss'?'L':'D').join(' ') || '—',
    timer:clock(elapsed(s.session)), form:h.form, whiteRate:h.whiteRate, blackRate:h.blackRate, opponent:h.opponent, opening:h.opening,
    endings:h.endings, accuracy:h.accuracy, puzzle:s.api.stats?.puzzle_rush?.best?.score??'—'
  };
}
export function renderCanvas(canvas,s,{editor=false}={}) {
  canvas.style.setProperty('--accent',s.theme.accent); canvas.style.setProperty('--card-bg',rgba(s.theme.background,s.theme.opacity));
  canvas.style.setProperty('--ink',s.theme.foreground); canvas.style.setProperty('--quiet',s.theme.muted);
  canvas.style.setProperty('--streak',s.theme.streak); canvas.style.setProperty('--radius',`${s.theme.radius}px`);
  canvas.style.setProperty('--font-size',`${s.theme.font}px`); canvas.style.setProperty('--padding',`${s.theme.padding}px`); canvas.style.setProperty('--row-gap',`${s.theme.gap}px`);
  const values=statValues(s);
  for(const id of ['stats','scoreboard','ticker']) {
    let wrapper=canvas.querySelector(`[data-widget="${id}"]`);
    if(!wrapper) { wrapper=el('div',`broadcast-widget ${id}-widget`); wrapper.dataset.widget=id; canvas.append(wrapper); }
    const w=s.widgets[id];
    wrapper.style.cssText=`left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;z-index:${w.z};display:${w.visible?'block':'none'}`;
    wrapper.classList.toggle('position-locked',s.layoutLocked||w.locked);
    if(id==='ticker') { renderTicker(wrapper,s); }
    else {
      wrapper.replaceChildren(); const card=el('div',`broadcast-card ${id}-card`); wrapper.append(card); card.style.width=`${w.w/w.scale}px`;
      if(id==='stats') {
        for(const field of s.fields.filter(f=>f.visible)) {
          const [icon,label]=FIELDS[field.id];
          if(field.id==='username') {
            const header=el('div','player-header');
            if(s.showAvatar && s.api.profile?.avatar && /^https:\/\//.test(s.api.profile.avatar)) { const img=el('img','player-avatar'); img.src=s.api.profile.avatar; img.alt=''; img.referrerPolicy='no-referrer'; header.append(img); }
            else header.append(el('span','crown','♛'));
            header.append(el('span','player-name',s.username)); card.append(header); continue;
          }
          const row=el('div',`stat-row ${field.id===s.activeMode?'active-rating':''}`);
          const left=el('span','stat-label'); left.append(el('span','stat-icon',icon),el('span','',label));
          const val=el('span','stat-value',values[field.id]);
          if(field.id==='timer') val.dataset.timer='true';
          if(field.id==='streak') { val.classList.add('streak-badge'); val.classList.toggle('loss',streaks(s.session).kind==='loss'); }
          if(field.id==='recent') val.classList.add('result-strip');
          if(['opening','endings'].includes(field.id)) row.classList.add('long-value');
          row.append(left,val); card.append(row);
          if(field.id==='goal' && rating(s,s.activeMode)!=null) {
            const track=el('div','goal-track'), bar=el('div','goal-fill'); bar.style.width=`${Math.min(100,rating(s,s.activeMode)/s.goals[s.activeMode]*100)}%`; track.append(bar); card.append(track);
          }
        }
      } else {
        card.append(el('div','scoreboard-heading','THIS SESSION'));
        const scores=el('div','scoreboard-values'), t=totals(s.session);
        for(const [k,label] of [['win','WINS'],['loss','LOSSES'],['draw','DRAWS']]) if(s.parts[k]) { const cell=el('div',`scoreboard-cell ${k}`); cell.append(el('strong','',t[k]),el('span','',label)); scores.append(cell); }
        card.append(scores);
      }
      requestAnimationFrame(()=>{
        const fit=Math.min(w.scale,w.h/Math.max(1,card.scrollHeight)); card.style.transform=`scale(${fit})`;
      });
    }
    if(editor && !wrapper.querySelector('.resize-handle')) { const handle=el('button','resize-handle'); handle.type='button'; handle.setAttribute('aria-label',`Resize ${id}`); wrapper.append(handle); }
  }
}
function renderTicker(wrapper,s) {
  const messages=tickerMessages(s), t=s.ticker, key=JSON.stringify([messages,t,s.widgets.ticker.w,s.widgets.ticker.h,s.theme]);
  if(wrapper.dataset.tickerKey===key) return;
  wrapper.dataset.tickerKey=key;
  clearInterval(wrapper._rotation); wrapper._animation?.cancel(); wrapper.replaceChildren();
  if(!messages.length) return;
  const surface=el('div','ticker-surface'); surface.style.background=rgba(s.theme.background,t.opacity); surface.style.fontSize=`${t.font}px`;
  const tag=el('span','ticker-tag',s.channel.toUpperCase()); surface.append(tag);
  const window=el('div','ticker-window'); surface.append(window); wrapper.append(surface);
  const line=el('span','ticker-line'); window.append(line);
  if(t.mode==='rotate') {
    let index=0; line.textContent=messages[0]; line.classList.add('ticker-rotation');
    if(!t.paused) wrapper._rotation=setInterval(()=>{index=(index+1)%messages.length; line.textContent=messages[index];},t.interval*1000);
  } else {
    messages.forEach((message,index)=>{if(index){const sep=el('span','ticker-separator',t.separator);sep.style.margin=`0 ${t.gap}px`;line.append(sep);}line.append(el('span','',message));});
    requestAnimationFrame(()=>{
      const distance=window.clientWidth+line.scrollWidth;
      const travel=distance/t.speed*1000,total=travel+t.pause*1000;
      const start=t.direction==='left'?window.clientWidth:-line.scrollWidth,end=t.direction==='left'?-line.scrollWidth:window.clientWidth;
      const frames=[{transform:`translateX(${start}px)`,offset:0},{transform:`translateX(${end}px)`,offset:travel/total},{transform:`translateX(${end}px)`,offset:1}];
      wrapper._animation=line.animate(frames,{duration:total,iterations:Infinity,easing:'linear'});
      if(t.paused) wrapper._animation.pause();
    });
  }
}
export function tickCanvas(canvas,s) { for(const e of canvas.querySelectorAll('[data-timer]')) e.textContent=clock(elapsed(s.session)); }
