import type { Translation } from '../core';
import type { CareerCleanupMsgs } from '../ko/careerCleanup';

export const careerCleanup: Translation<CareerCleanupMsgs> = {
  title: 'Clean up old careers',
  body: 'Clean up careers you left behind when you started over with a new player. Retired players keep their records, cards and Hall of Fame entries.',
  find: 'Find careers to clean up',
  finding: 'Searching…',
  none: 'No careers to clean up.',
  found: (p) => `${p.n} careers have not been continued for over a day.`,
  clear: (p) => `Clean up ${p.n}`,
  clearing: 'Cleaning up…',
  confirmTitle: 'Clean up old careers',
  confirm: (p) =>
    `Clean up ${p.n} careers? The career you are playing on this device is left out. If you continue a cleaned-up career from a backup, it is restored.`,
  cancel: 'Cancel',
  ok: 'Clean up',
  done: (p) => `Cleaned up ${p.n} careers.`,
  error: 'Could not load. Please try again in a moment.',
  clearError: (p) => `Stopped after cleaning up ${p.n} careers. Please try again in a moment.`,
};
