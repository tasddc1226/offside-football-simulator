import type { Translation } from '../core';
import type { CompIconsMsgs } from '../ko/compIcons';
import { plural } from './_util';

export const compIcons: Translation<CompIconsMsgs> = {
  sheetTitle: (p) => `${p.name} logo`,
  intro:
    'Swap this logo for an image you pick. It’s saved on this device only, and share images and other players still see the default logo.',
  where:
    'See every league and competition logo in Settings → Rename competitions and awards, change logos.',
  pick: 'Choose image',
  reset: 'Use default logo',
  close: 'Close',
  logoLabel: (p) => `Change ${p.name} logo`,
  hint: 'Leagues and competitions now have logos. Tap a logo to use your own image.',
  hintClose: 'Got it',
  custom: 'My image',
  saved: 'Logo changed',
  restored: 'Back to the default logo',
  big: 'Couldn’t shrink this image. Pick a simpler one',
  tooLarge: 'Pick an image under 10 MB',
  readFail: 'Couldn’t read the image',
  full: 'No room for more logo images. Set unused logos back to default',
  noSpace: 'Not enough storage space to save',
  changed: (p) => `${plural(p.n, 'logo')} changed`,
  imported: (p) => `Loaded ${plural(p.n, 'logo')}`,
};
