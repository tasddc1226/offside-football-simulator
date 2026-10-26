import type { Translation } from '../core';
import type { GameCareMsgs } from '../ko/gameCare';

export const gameCare: Translation<GameCareMsgs> = {
  title: 'Conditioning',
  tier1: 'Basic care',
  tier2: 'Focused care',
  tier3: 'Personal medical team',
  lineOpen: 'Your stats will drop when this season ends. Conditioning makes the drop smaller.',
  lineDone: (p) => `You are on ${p.name} this season. The end-of-season drop is ${p.cut}% smaller.`,
  option: (p) => `Drop ${p.cut}% smaller`,
  short: 'Not enough money',
  confirm: (p) =>
    `Spend ${p.cost} on ${p.name}. It only affects this season's drop and can't be undone.`,
  confirmBtn: 'Start',
  cancel: 'Cancel',
  note: 'You can get it once per season. It costs more the further you are past your peak age.',
  done: (p) => `Started ${p.name}.`,
};
