import type { Translation } from '../core';
import type { GamePotentialMsgs } from '../ko/gamePotential';

export const gamePotential: Translation<GamePotentialMsgs> = {
  peekLocked: 'You can see the scouting rating after your first season.',
  peekAvailable: 'Your real potential is revealed when you retire.',
  peekShown: (p) => `Grade ${p.grade} · ${p.year} season scouting report`,
  peekBtnFree: "See this season's rating",
  peekBtnAd: "Watch an ad to see this season's rating",
  peekBtnPay: (p) => `Pay ${p.cost} to see this season's rating`,
  peekShort: (p) => `Not enough funds. You need ${p.cost} to see this season's rating.`,
};
