import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCreditsSource} from '../public/credits-source.mjs';
import {CreditsTimeline} from '../public/bonus-render.mjs';

function fixture() {
  const target=new EventTarget(),timeline=new CreditsTimeline(0,true);
  let now=0,seq=null;const commands=[];
  const player={
    command(cmd){commands.push(cmd);timeline.command(cmd,now);},
    update(settings,playback){if(seq!==null&&seq!==playback.seq)this.command(playback.command);seq=playback.seq;}
  };
  const source=createCreditsSource(player,target);
  return {source,timeline,commands,advance(ms){now+=ms;timeline.tick(now);},
    active(value){const event=new Event('obsSourceActiveChanged');event.detail={active:value};target.dispatchEvent(event);},
    update(seq=0,command='stop'){source.update({}, {seq,command});}};
}

test('credits reset off-air and restart on each activation without restarting on duplicate events or state updates',()=>{
  const f=fixture();f.update();f.advance(9000);assert.equal(f.timeline.elapsed,9000);
  f.active(false);f.advance(20000);assert.equal(f.timeline.elapsed,0);assert.equal(f.timeline.stopped,true);
  f.active(true);f.advance(2000);assert.equal(f.timeline.elapsed,2000);
  f.active(true);f.update();f.advance(1000);assert.equal(f.timeline.elapsed,3000);
  f.active(false);f.active(true);assert.equal(f.timeline.elapsed,0);assert.equal(f.timeline.running,true);
  f.active('true');assert.deepEqual(f.commands,['stop','restart','stop','restart']);
});

test('activation before settings waits for content and inactive state survives initial load and remote play',()=>{
  const early=fixture();early.active(true);early.advance(10000);early.update();assert.equal(early.timeline.elapsed,0);
  const off=fixture();off.active(false);off.update();off.advance(10000);assert.equal(off.timeline.elapsed,0);
  off.update(1,'restart');off.advance(2000);assert.equal(off.timeline.stopped,true);assert.equal(off.timeline.elapsed,0);
  off.active(true);off.advance(1000);assert.equal(off.timeline.elapsed,1000);
  off.update(2,'pause');off.advance(5000);assert.equal(off.timeline.elapsed,1000);
  off.update(3,'play');off.advance(2000);assert.equal(off.timeline.elapsed,3000);
});

test('sources stay independent and browser playback needs no OBS events',()=>{
  const a=fixture(),b=fixture();a.update();b.update();a.active(false);b.advance(5000);assert.equal(b.timeline.elapsed,5000);
  a.source.dispose();a.active(true);assert.equal(a.timeline.stopped,true);
});
