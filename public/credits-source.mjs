// OBS sends this per-source event; ordinary browser tab visibility is unrelated.
export function createCreditsSource(player, target) {
  let active, ready=false;
  function onActive(event) {
    const next=event.detail?.active;
    if(typeof next!=='boolean'||next===active)return;
    active=next;
    if(ready)player.command(active?'restart':'stop');
  }
  target.addEventListener('obsSourceActiveChanged',onActive);
  return {
    update(settings,playback) {
      player.update(settings,playback);
      // Activation may arrive before the initial SSE settings. Start the clock
      // only when content is ready, and never let remote commands run off-air.
      if(active===false)player.command('stop');
      else if(!ready&&active===true)player.command('restart');
      ready=true;
    },
    dispose(){target.removeEventListener('obsSourceActiveChanged',onActive);}
  };
}
