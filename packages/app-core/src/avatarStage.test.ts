import { expect, it } from 'vitest';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { runnerDuration, canRun } from './avatarStage.js';
import type { AvatarSpec } from '@offside/game/avatar';

it('decorative travel does not consume game RNG and respects static fallback conditions', () => {
  const previous = getActiveRng();
  const rng = createRng(609);
  setActiveRng(rng);
  const before = rng.getState();
  try {
    expect(runnerDuration(220)).toBe(4000);
    expect(canRun({ acc: [] } as unknown as AvatarSpec, true)).toBe(true);
    expect(canRun({ acc: [] } as unknown as AvatarSpec, false)).toBe(false);
    for (const acc of ['crutch', 'suit', 'bouquet'])
      expect(canRun({ acc: [acc] } as AvatarSpec, true)).toBe(false);
    expect(rng.getState()).toEqual(before);
  } finally {
    setActiveRng(previous);
  }
});
