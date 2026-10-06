import type { Translation } from '../core';
import type { AppFormatMsgs } from '../ko/appFormat';

export const appFormat: Translation<AppFormatMsgs> = {
  won: (p) => p.v,
  zeroWon: '0',
};
