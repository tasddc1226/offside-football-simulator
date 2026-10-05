import type { Translation } from '@offside/contracts/i18n';
import type { GMinigameMsgs } from '../ko/gMinigame';

export const gMinigame: Translation<GMinigameMsgs> = {
  tapShot: 'Shoot!',
  tapChip: 'Chip it!',
  tapDribble: 'Take him on!',
  tapSave: 'Dive!',
  zoneWide: 'Wide',
  zoneMedium: 'Medium',
  zoneNarrow: 'Narrow',
  timeout: (p) => `Time's up. You didn't tap within ${p.sec} seconds.`,
  perfect: 'Perfect timing!',
  good: 'Good timing',
  close: 'Just missed the timing',
  miss: 'You missed the timing',
};
