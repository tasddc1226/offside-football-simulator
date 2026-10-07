import type { Translation } from '../core';
import type { AppFormatMsgs } from '../ko/appFormat';

// 일본어 금액은 fmtMoney가 ₩ 기호를 붙여 준다(₩3億5,000万).
export const appFormat: Translation<AppFormatMsgs> = {
  won: (p) => p.v,
  zeroWon: '₩0',
};
