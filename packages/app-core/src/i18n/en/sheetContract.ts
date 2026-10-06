import type { Translation } from '../core';
import type { SheetContractMsgs } from '../ko/sheetContract';

export const sheetContract: Translation<SheetContractMsgs> = {
  close: 'Close contract',
  padLabel: 'Player signature area',
  signHint: 'Sign here',
  signNote: "This is your in-game player's fictional signature",
  clear: 'Redo',
  nameSign: 'Sign with name',
  flightA11y: (p) => `Flight path from ${p.from} to ${p.to}`,
};
