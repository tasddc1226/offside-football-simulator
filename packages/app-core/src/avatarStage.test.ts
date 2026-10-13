import { expect, it } from 'vitest';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { fieldBeat, fieldGeometry } from './avatarStage.js';

it('visual choreography includes running, shooting and training without consuming game RNG', () => {
  const previous = getActiveRng();
  const rng = createRng(609);
  setActiveRng(rng);
  const before = rng.getState();
  try {
    const beats = Array.from({ length: 70 }, (_, i) => fieldBeat(i));
    expect(new Set(beats.map((b) => b.motion))).toEqual(
      new Set(['idle', 'run', 'shoot', 'dribble', 'juggle', 'header']),
    );
    expect(
      beats.every((b) => b.x >= 0.2 && b.x <= 0.8 && b.y! >= 0.3 && b.y! <= 0.8 && b.ms > 0),
    ).toBe(true);
    expect(rng.getState()).toEqual(before);
  } finally {
    setActiveRng(previous);
  }
});

it('pitch markings follow portrait and landscape bounds without stretching the center circle', () => {
  for (const [w, h] of [
    [296, 420],
    [600, 300],
    [400, 700],
  ]) {
    const p = fieldGeometry(w!, h!);
    expect(p.w).toBe(w);
    expect(p.h).toBe(h);
    expect(p.radius * 2).toBeLessThan(Math.min(w!, h!));
    expect(
      p.boxes.every(
        (b) =>
          b.x >= p.p - 0.001 &&
          b.y >= p.p - 0.001 &&
          b.x + b.w <= w! - p.p + 0.001 &&
          b.y + b.h <= h! - p.p + 0.001,
      ),
    ).toBe(true);
  }
});
