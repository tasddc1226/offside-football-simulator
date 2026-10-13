// T-11-153 운영 도구 구단 자금 대조(웹 admin/AdminFunds.svelte · 앱 settings/admin/AdminFunds.tsx 공용). 운영 도구는 한국어.
import type { AdminFundsMove } from '@offside/contracts';
import { fundsText } from '../funds.js';

export const FUNDS_MOVE: Record<Exclude<AdminFundsMove['kind'], 'item'>, string> = {
  released: '방출',
  bonus: '은퇴 장려금',
  sold: '판매',
  bought: '영입',
};
const ITEM: Record<string, string> = {
  reroll: '리롤권 구매',
  scout: '프리미엄 스카우트권 구매',
  'reward:candidates': '광고 대신 · 후보 잠재력',
  'reward:peek': '광고 대신 · 시즌 평가',
  'reward:boost': '광고 대신 · 잠재력 강화',
};
/** owner_item_purchases.item 이름(모르는 값은 그대로). */
export const fundsItemName = (item: string) => ITEM[item] ?? item;
/** T-11-245 구단주 한 명의 프리미엄 스카우트권 사용 현황 한 줄. */
export const scoutUsageText = (s: {
  used: number;
  streak: number;
  elites: number;
  held: number;
  paid: number;
}) =>
  `프리미엄 스카우트권 · 누적 사용 ${s.used}장 · S 없이 연속 ${s.streak}장 · 특급 S ${s.elites}회 · 보유 ${s.held}장 · 앱 구매 ${s.paid}장`; // i18n-ignore: 운영 도구
/** 부호를 붙인 금액(+ 들어옴 · − 나감). */
export const signedFunds = (man: number) => `${man < 0 ? '−' : '+'}${fundsText(Math.abs(man))}`;
