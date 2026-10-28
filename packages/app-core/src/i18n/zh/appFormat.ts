import type { Translation } from '../core';
import type { AppFormatMsgs } from '../ko/appFormat';

// fmtMoney adds the ₩ sign for zh amounts (₩3億5,000萬).
export const appFormat: Translation<AppFormatMsgs> = {
  won: (p) => p.v,
  zeroWon: '₩0',
};
