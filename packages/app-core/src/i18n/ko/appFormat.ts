// 원화 금액 표기 꼬리(boost-view.ts · market.ts · 앱 선수 탭). 금액 자체는 game fmtMoney·fmtValue가 만든다.
import { ns } from '../core';

const ko = {
  /** 만 원 단위 표기('1억 2,000만') 뒤에 단위 '원'을 붙인다. */
  won: (p: { v: string }) => `${p.v}원`,
  zeroWon: '0원',
};

export type AppFormatMsgs = typeof ko;
export const appFormatText = ns('appFormat', ko);
