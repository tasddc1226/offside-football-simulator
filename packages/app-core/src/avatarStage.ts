// Decorative popup runner: shared web/native size, pace and static fallback. No game RNG.
import type { AvatarSpec } from '@offside/game/avatar';

export const RUNNER_SIZE = 56;
/** Full out-and-back loop, at roughly 110 screen pixels per second. */
export const runnerDuration = (travel: number): number => Math.max(1600, (travel / 110) * 2000);
export const canRun = (spec: AvatarSpec, motionOK: boolean): boolean =>
  motionOK && !spec.acc.some((a) => a === 'crutch' || a === 'suit' || a === 'bouquet');
