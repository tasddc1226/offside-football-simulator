import type { Translation } from '../core';
import type { PlayerNudgeMsgs } from '../ko/playerNudge';

export const playerNudge: Translation<PlayerNudgeMsgs> = {
  readyTitle: 'You can try a potential boost',
  scoutTitle: "This season's scout report is in",
  readyText: (p) =>
    `${p.cost} · ${p.chance}% success chance. If it fails, you don't get the money back.`,
  scoutText:
    "See this season's report in the Player tab. Your true potential is revealed when you retire.",
  aria: 'Player tab tip',
  open: 'Go to Player tab',
  closeAria: 'Close Player tab tip',
  close: 'Close',
  tabHint: 'Potential tip',
};
