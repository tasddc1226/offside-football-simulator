import type { Translation } from '@offside/contracts/i18n';
import type { GCareMsgs } from '../ko/gCare';

export const gCare: Translation<GCareMsgs> = {
  bought: (p) =>
    `Started a conditioning program. The stat drop at the end of this season is ${p.cut}% smaller (${p.cost}).`,
};
