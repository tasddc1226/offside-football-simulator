import type { Translation } from '@offside/contracts/i18n';
import type { GStatsMsgs } from '../ko/gStats';
import { plural } from './_gUtil';

export const gStats: Translation<GStatsMsgs> = {
  potAch0: 'You went past your natural limit.',
  potAch1: 'You drew out every bit of your talent.',
  potAch2: 'You left a little in the tank.',
  potAch3: 'A talent that never fully bloomed.',
  rescoutLate: 'Verdict: a late bloomer.',
  rescoutEarly: 'Verdict: your growth curve leveled off earlier than expected.',
  rescoutNarrow: 'The scouts have narrowed their estimate.',
  rescoutLog: (p) => `Scout reassessment: potential grade ${p.before} → ${p.after}. ${p.note}`,
  rescoutNote: (p) => `Scout reassessment · potential ${p.before} → ${p.after}`,
  chipCond: 'Condition',
  chipMorale: 'Morale',
  chipFame: 'Popularity',
  chipTrust: 'Manager trust',
  chipMoney: 'Funds',
  chipInjury: 'Injury',
  chipOut: (p) => `${p.n} ${plural(p.n, 'match', 'matches')} out`,
  chipPot: 'Potential',
  chipPotUp: 'Up',
  twistSafe: (p) => `The price of playing safe · ${p.why}`,
  twistUp: (p) => `Unexpected gain · ${p.label} +${p.d}`,
  twistDown: (p) => `Unexpected fallout · ${p.label} ${p.d}`,
  costMoraleLabel: 'Morale',
  costMoraleWhy: 'Regret at playing it safe',
  costTrustLabel: 'Manager trust',
  costTrustWhy: "The manager's lukewarm opinion",
  costFameLabel: 'Fame',
  costFameWhy: 'Seen as "decent, nothing special"',
};
