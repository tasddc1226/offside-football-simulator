// Shared popup choreography. Presentation only; never consumes game RNG.
import type { AvatarSpec } from '@offside/game/avatar';
import { MOTIONS, type MotionId } from '@offside/game/avatar-motion';

export const RUNNER_SIZE = 56;
export const RUNNER_HEIGHT = (RUNNER_SIZE * 9) / 8;
export const GOAL_WIDTH = 34;
export const GOAL_HEIGHT = 34;
export const BALL_SIZE = 8;
export const canRun = (spec: AvatarSpec, motionOK: boolean): boolean =>
  motionOK && !spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet');

// Same pixel goal on web and native; [x, y, width, height, net].
export const GOAL_RECTS: readonly (readonly [number, number, number, number, boolean])[] = [
  ...[8, 14, 20, 26].map((x) => [x, 8, 1, 24, true] as const),
  ...[10, 16, 22, 28].map((y) => [5, y, 25, 1, true] as const),
  [2, 2, 24, 3, false],
  [2, 2, 3, 30, false],
  [24, 4, 4, 2, false],
  [27, 6, 4, 2, false],
  [30, 8, 3, 24, false],
  [3, 30, 30, 2, false],
];
export const GOAL_COLORS = { frame: '#ecf2ee', net: '#a1b3a8', scored: '#f4c760' };

export const runnerTimeline = (width: number) => {
  const travel = Math.max(0, width - GOAL_WIDTH - RUNNER_SIZE - 56);
  // Even a short preseason can reach the shot; do not extend game progress for the decoration.
  const runMs = Math.min(1100, Math.max(650, (travel / 180) * 1000));
  const kickMs = MOTIONS.shoot.frames.slice(0, 2).reduce((sum, f) => sum + f.ms, 0);
  const shotMs = MOTIONS.shoot.frames.reduce((sum, f) => sum + f.ms, 0);
  return {
    travel,
    goalLeft: Math.max(0, width - GOAL_WIDTH),
    runMs,
    kickAt: runMs + kickMs,
    goalAt: runMs + kickMs + 420,
    resetAt: runMs + shotMs,
    cycleMs: runMs + shotMs + 240,
  };
};

export type RunnerPhase = 'idle' | 'run' | 'shoot' | 'goal' | 'reset';
function frameAt(motion: MotionId, elapsed: number): number {
  const frames = MOTIONS[motion].frames;
  const duration = frames.reduce((sum, f) => sum + f.ms, 0);
  let time = motion === 'run' ? elapsed % duration : Math.min(elapsed, duration - 1);
  for (let i = 0; i < frames.length; i++) {
    if (time < frames[i]!.ms) return i;
    time -= frames[i]!.ms;
  }
  return 0;
}

/** Run toward the waiting ball, kick, score, fade, restart from the left. */
export function runnerScene(width: number, elapsed: number, active = true) {
  const t = runnerTimeline(width);
  const time = elapsed % t.cycleMs;
  let phase: RunnerPhase = 'idle';
  if (active)
    phase =
      time < t.runMs ? 'run' : time < t.goalAt ? 'shoot' : time < t.resetAt ? 'goal' : 'reset';
  const motion: MotionId = phase === 'run' ? 'run' : phase === 'idle' ? 'idle' : 'shoot';
  const flight = active ? Math.min(1, Math.max(0, (time - t.kickAt) / 420)) : 0;
  const ballStart = t.travel + 40;
  const ballEnd = t.goalLeft + 18;
  return {
    phase,
    motion,
    frame: active ? frameAt(motion, phase === 'run' ? time : time - t.runMs) : 0,
    x: phase === 'run' ? (t.travel * time) / t.runMs : phase === 'idle' ? 0 : t.travel,
    playerOpacity: phase === 'reset' ? 1 - (time - t.resetAt) / 240 : 1,
    ballX: ballStart + (ballEnd - ballStart) * flight,
    ballY: RUNNER_HEIGHT - 11 - 12 * flight - 14 * Math.sin(Math.PI * flight),
    ballOpacity: phase === 'reset' ? 0 : 1,
    scored: phase === 'goal',
  };
}
