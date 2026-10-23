import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TickerClock,rotationIndex,scrollOffset } from '../public/ticker.mjs';
test('rotation advances across repeated state updates without restarting',()=>{
  const c=new TickerClock(0);c.update(2000,false);c.update(4000,false);c.update(6000,false);
  assert.equal(rotationIndex(c.elapsed,5,3),1);c.update(16000,false);assert.equal(rotationIndex(c.elapsed,5,3),0);
});
test('pause freezes elapsed time and resume continues from the same point',()=>{
  const c=new TickerClock(0);c.update(3000,true);c.update(20000,true);assert.equal(c.elapsed,3000);
  c.update(25000,false);c.update(28000,false);assert.equal(c.elapsed,6000);assert.equal(rotationIndex(c.elapsed,5,3),1);
});
test('scroll starts with content visible, supports both directions, and holds content at loop end',()=>{
  assert.equal(scrollOffset(0,1000,100,2,'left'),0);
  assert.equal(scrollOffset(5000,1000,100,2,'left'),-500);
  assert.equal(scrollOffset(11000,1000,100,2,'left'),-1000);
  assert.equal(scrollOffset(12000,1000,100,2,'left'),0);
  assert.equal(scrollOffset(0,1000,100,2,'right'),-1000);
  assert.equal(scrollOffset(5000,1000,100,2,'right'),-500);
});
