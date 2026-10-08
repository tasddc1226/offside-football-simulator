import type { Translation } from '../core';
import type { CupAppMsgs } from '../ko/cupApp';

export const cupApp: Translation<CupAppMsgs> = {
  cancel: 'Cancel',
  withdrawAskTitle: 'Withdraw your entry?',
  withdrawKeep: 'Keep entry',
  actionFail: "That didn't go through. Try again in a moment.",
  groupToggle: (p) => `Expand or collapse ${p.name}`,
  roundToggle: (p) => `Expand or collapse ${p.name}`,
  rerollAskTitle: 'Redraw the candidates?',
  rerollAction: 'Redraw',
  shopAskTitle: 'Buy a reroll ticket?',
  shopAction: 'Buy',
};
