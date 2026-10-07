import type { Translation } from '@offside/contracts/i18n';
import type { GPeekMsgs } from '../ko/gPeek';

export const gPeek: Translation<GPeekMsgs> = {
  paid: (p) => `Paid the scouts ${p.cost} for this season's potential rating.`,
};
