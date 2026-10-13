import { expect, it } from 'vitest';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import { runnerScene, canRun } from './avatarStage.js';
import type { AvatarSpec } from '@offside/game/avatar';

it('run, kick and goal choreography stays inside narrow tracks and never consumes game RNG', () => {
  const previous = getActiveRng();
  const rng = createRng(609);
  setActiveRng(rng);
  const before = rng.getState();
  try {
    for (const width of [296, 366, 436]) {
      const frames = Array.from({ length: 180 }, (_, i) => runnerScene(width, i * 20));
      expect(new Set(frames.map((f) => f.phase))).toEqual(
        new Set(['run', 'shoot', 'goal', 'reset']),
      );
      const firstKick = frames.find((f) => f.phase === 'shoot')!;
      const goal = frames.find((f) => f.scored)!;
      expect(firstKick.motion).toBe('shoot');
      expect(goal.ballX).toBeGreaterThan(firstKick.ballX);
      expect(frames.every((f) => f.x >= 0 && f.x + 56 <= width && f.ballX + 8 <= width)).toBe(true);
      // Restart after the fade, rather than an invisible return run across the popup.
      expect(
        frames.filter((f, i) => i && f.phase === 'run' && frames[i - 1]!.phase === 'reset').length,
      ).toBe(1);
    }
    expect(rng.getState()).toEqual(before);
  } finally {
    setActiveRng(previous);
  }
});

it('reduced motion and static accessories stop running, kicking and ball flight', () => {
  expect(canRun({ acc: [] } as unknown as AvatarSpec, false)).toBe(false);
  for (const acc of ['crutch', 'suit', 'bouquet'])
    expect(canRun({ acc: [acc] } as AvatarSpec, true)).toBe(false);
  expect(runnerScene(296, 1800, false)).toEqual(runnerScene(296, 0, false));
});
