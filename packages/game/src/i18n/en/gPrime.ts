import type { Translation } from '@offside/contracts/i18n';
import type { GPrimeMsgs } from '../ko/gPrime';

export const gPrime: Translation<GPrimeMsgs> = {
  success: (p) =>
    `Prime extended. Stats now start dropping after the age-${p.peak} season${p.ad ? ' (ad)' : ` (${p.cost})`}.`,
  great: (p) =>
    `Great success! Two years added at once. Stats now start dropping after the age-${p.peak} season${p.ad ? ' (ad)' : ` (${p.cost})`}.`,
  fail: (p) =>
    `Prime extension failed${p.ad ? ' (ad)' : ` (${p.cost})`}. The next try has a better chance.`,
};
