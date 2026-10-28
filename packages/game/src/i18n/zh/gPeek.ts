import type { Translation } from '@offside/contracts/i18n';
import type { GPeekMsgs } from '../ko/gPeek';

export const gPeek: Translation<GPeekMsgs> = {
  paid: (p) => `付給球探${p.cost}，取得本賽季的潛力評估。`,
};
