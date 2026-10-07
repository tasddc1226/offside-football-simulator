// T-11-145 홈 화면의 오프사이드 컵 카드를 보일지. 대회 소식은 구단주 탭이 아니라 모두가 먼저 보는 홈에서 알린다.
// 취소된 대회는 숨기고, 끝난 대회는 결승 뒤 일주일 동안만 우승 소식으로 남긴다.
import type { CupResponse } from './api/cup.js';

export const CUP_HOME_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function cupOnHome(c: Pick<CupResponse, 'phase' | 'cup'>, now = Date.now()): boolean {
  if (c.phase === 'cancelled') return false;
  if (c.phase !== 'done') return true;
  const last = c.cup.rounds.at(-1)?.at;
  return !!last && now < Date.parse(last) + CUP_HOME_AFTER_MS;
}
