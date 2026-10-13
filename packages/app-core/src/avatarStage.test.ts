import { expect, it } from 'vitest';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { progressBeat } from './avatarStage.js';

it('visual choreography includes running, shooting and training without consuming game RNG', () => {
  const previous = getActiveRng();
  const rng = createRng(609);
  setActiveRng(rng);
  const before = rng.getState();
  try {
    const beats = Array.from({ length: 70 }, (_, i) => progressBeat(i));
    expect(new Set(beats.map((b) => b.motion))).toEqual(
      new Set(['idle', 'run', 'shoot', 'dribble', 'juggle', 'header']),
    );
    expect(beats.every((b) => b.ms > 0)).toBe(true);
    expect(rng.getState()).toEqual(before);
  } finally {
    setActiveRng(previous);
  }
});
