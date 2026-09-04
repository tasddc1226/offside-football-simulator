import { describe, expect, it } from 'vitest';
import {
  appendSwipeSample,
  committedSwipe,
  resistedSwipe,
  stepSwipeSpring,
  swipeIntent,
  swipeVelocity,
} from './swipe-motion.js';

describe('swipe motion', () => {
  it('waits for intent and prioritizes vertical scrolling', () => {
    expect(swipeIntent(9, 2)).toBe('pending');
    expect(swipeIntent(11, 10)).toBe('pending');
    expect(swipeIntent(10, 0)).toBe('horizontal');
    expect(swipeIntent(-20, 3)).toBe('horizontal');
    expect(swipeIntent(10, 12)).toBe('vertical');
  });

  it('requires a quarter width or at least 72 px for a slow drag', () => {
    expect(committedSwipe(89, 0, 360, false, true)).toBeNull();
    expect(committedSwipe(90, 0, 360, false, true)).toBe('right');
    expect(committedSwipe(71, 0, 240, false, true)).toBeNull();
    expect(committedSwipe(-90, 0, 360, true, false)).toBe('left');
  });

  it('accepts a recent flick only with meaningful travel in an allowed direction', () => {
    expect(committedSwipe(39, 2, 360, false, true)).toBeNull();
    expect(committedSwipe(40, 0.55, 360, false, true)).toBe('right');
    expect(committedSwipe(-40, -0.55, 360, true, false)).toBe('left');
    expect(committedSwipe(140, 1, 360, true, false)).toBeNull();
    expect(committedSwipe(0, 2, 360, true, true)).toBeNull();
  });

  it('cancels an intentional last-moment reversal', () => {
    expect(committedSwipe(140, -0.4, 360, false, true)).toBeNull();
    expect(committedSwipe(-140, 0.4, 360, true, false)).toBeNull();
  });

  it('does not reuse velocity after a pause before release', () => {
    const samples = appendSwipeSample(
      [
        { x: 0, time: 0 },
        { x: 50, time: 50 },
      ],
      { x: 50, time: 200 },
    );
    expect(samples).toEqual([{ x: 50, time: 200 }]);
    expect(swipeVelocity(samples)).toBe(0);
    expect(
      swipeVelocity([
        { x: 1, time: 0 },
        { x: 80, time: 0 },
      ]),
    ).toBe(0);
    expect(
      swipeVelocity([
        { x: 0, time: 0 },
        { x: 50, time: 50 },
      ]),
    ).toBe(1);
  });

  it('follows 1:1 before progressively resisting the edge', () => {
    expect(resistedSwipe(100, 360)).toBe(100);
    expect(resistedSwipe(-100, 360)).toBe(-100);
    expect(resistedSwipe(400, 360)).toBeGreaterThan(216);
    expect(resistedSwipe(400, 360)).toBeLessThan(288);
    expect(resistedSwipe(10000, 360)).toBeLessThan(288);
  });

  it('settles without a bounce and preserves the live state at interruption', () => {
    let state = { position: 100, velocity: 0 };
    const same = stepSwipeSpring(state.position, state.velocity, 0);
    expect(same).toEqual(state);
    for (let frame = 0; frame < 18; frame += 1) {
      const next = stepSwipeSpring(state.position, state.velocity, 16);
      expect(next.position).toBeGreaterThanOrEqual(0);
      expect(next.position).toBeLessThan(state.position);
      state = next;
    }
    expect(state.position).toBeLessThan(0.25);
    expect(Math.abs(state.velocity)).toBeLessThan(0.01);
  });
});
