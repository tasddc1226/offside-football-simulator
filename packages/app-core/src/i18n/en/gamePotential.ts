import type { Translation } from '../core';
import type { GamePotentialMsgs } from '../ko/gamePotential';

export const gamePotential: Translation<GamePotentialMsgs> = {
  peekLocked: 'You can see the scouting rating after your first season.',
  peekAvailable:
    'Your real potential is revealed when you retire. Viewing the rating never changes it.',
  peekShown: (p) => `Grade ${p.grade} · ${p.year} season scouting report`,
  peekBtnFree: "See this season's rating",
  peekBtnAd: "Watch an ad to see this season's rating",
  peekBtnPay: (p) => `Pay ${p.cost} to see this season's rating`,
  peekShort: (p) => `Not enough funds. You need ${p.cost} to see this season's rating.`,
  flowTitle: 'How potential changed',
  flowStart: (p) => `Starting real potential ${p.grade} (${p.value})`,
  flowDrift: (p) => `Drift while developing (to age 25) ${p.d}`,
  flowBoost: (p) => `Potential boosts +${p.n}`,
  flowEnd: (p) => `Real potential at retirement ${p.grade} (${p.value})`,
  seedLine: (p) => `Career seed ${p.seed} · Balance version ${p.v}`,
  balLine: (p) => `Balance version ${p.v}`,
  seedNote:
    'Every match and event roll in this career followed from this seed. The same seed, balance and choices give the same result.',
};
