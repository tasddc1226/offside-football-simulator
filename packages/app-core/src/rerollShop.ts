// T-11-152 리롤권 상점 카드의 상태(웹 RerollShop.svelte · 앱 RerollShop.tsx가 같이 쓴다). 구단 자금으로 선수 후보 리롤권을
// 사는 곳이다. 수치(가격 · 상승 배율 · 하루 상한)는 서버가 운영 밸런스 설정에서 정해 응답에 담는다.
import type { RerollShopResponse } from './api/cup.js';
import { fundsText } from './funds.js';
import { cupText as L } from './i18n/ko/cup.js';

/** closed = 팔지 않음(상한 0), soldOut = 오늘 상한을 다 씀, short = 자금이 모자람, buy = 살 수 있음. */
export type RerollShopState = 'closed' | 'soldOut' | 'short' | 'buy';

export function rerollShopState(s: RerollShopResponse): RerollShopState {
  if (s.cap === 0) return 'closed';
  if (s.price === null) return 'soldOut';
  return s.balance < s.price ? 'short' : 'buy';
}

/** T-11-244 같은 응답의 프리미엄 스카우트권(한 주 상한). 옛 서버라 값이 없으면 null. */
export function scoutShopState(s: RerollShopResponse): RerollShopState | null {
  const x = s.scout;
  if (!x) return null;
  if (x.cap === 0) return 'closed';
  if (x.price === null) return 'soldOut';
  return s.balance < x.price ? 'short' : 'buy';
}

/** T-11-442 자금이 모자랄 때 얼마나 모자라는지(상점 문구). 모자라지 않으면 null. */
export function shopShortText(balance: number, price: number | null | undefined): string | null {
  if (price == null || balance >= price) return null;
  return L.shopShort({ short: fundsText(price - balance) });
}
