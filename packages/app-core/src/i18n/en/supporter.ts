import type { Translation } from '../core';
import type { SupporterMsgs } from '../ko/supporter';

export const supporter: Translation<SupporterMsgs> = {
  pill: (p) => (p.tier > 1 ? `Supporter ${p.tier}mo` : 'Supporter'),
  label: (p) =>
    p.tier > 1
      ? `Club membership supporter for ${p.tier}+ months in a row`
      : 'Club membership supporter',
};
