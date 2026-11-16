import type { Translation } from '@offside/contracts/i18n';
import type { GLegacyMsgs } from '../ko/gLegacy';

export const gLegacy: Translation<GLegacyMsgs> = {
  academy: 'Youth Academy',
  charity: 'Charity Foundation',
  club: 'First Pro Club Sponsorship',
  tier1: 'Bronze',
  tier2: 'Silver',
  tier3: 'Gold',
  tier4: 'Legend',
  settled: (p) =>
    `Retirement legacy: spent the remaining ${p.money} on ${p.kind} (${p.tier} tier).`,
};
