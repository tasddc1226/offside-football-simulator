// T-11-145 홈 화면의 오프사이드 컵 카드를 보일지. 대회 소식은 구단주 탭이 아니라 모두가 먼저 보는 홈에서 알린다.
// 취소된 대회는 숨기고, 끝난 대회는 결승 뒤 일주일 동안만 우승 소식으로 남긴다.
import { CUP_HOME_AFTER_MS } from '@offside/contracts/cup';
import { storage } from '@offside/game/storage';
import type { CupChampion, CupHomeResponse, CupResponse } from './api/cup.js';

export { CUP_HOME_AFTER_MS };

export function cupOnHome(c: Pick<CupResponse, 'phase' | 'cup'>, now = Date.now()): boolean {
  if (c.phase === 'cancelled') return false;
  if (c.phase !== 'done') return true;
  const last = c.cup.rounds.at(-1)?.at;
  return !!last && now < Date.parse(last) + CUP_HOME_AFTER_MS;
}

/** 조 추첨 전(접수 전·중·마감 뒤)인지. 대회 화면이 신청한 팀 목록·일정 펼침을 정한다(T-11-160). */
export const cupBeforeDraw = (phase: CupResponse['phase']) =>
  phase === 'soon' || phase === 'open' || phase === 'closed';

/**
 * T-11-290 우승 팝업 — 앱·웹을 열 때 가장 최근에 끝난 대회의 우승 팀을 한 번 보여 준다(서버가 결승 뒤 일주일 동안 champion을
 * 준다). '다시 보지 않기'를 누른 기기는 그 대회를 다시 보여 주지 않는다(대회 id로 기억하니 다음 대회 우승은 다시 보인다).
 */
export const CUP_CHAMPION_SEEN = 'ft_cup_champion_seen';

/** 이 기기에 보여 줄 우승. 없거나(끝난 대회 없음) 그 대회를 다시 보지 않기로 했으면 null. */
export function cupChampionToShow(
  home: Pick<CupHomeResponse, 'champion'> | null | undefined,
): CupChampion | null {
  const champion = home?.champion;
  if (!champion) return null;
  try {
    if (storage().getItem(CUP_CHAMPION_SEEN) === champion.cupId) return null;
  } catch {
    // 저장소가 막힌 환경이면 보여 준다(다음에도 한 번 더 보인다).
  }
  return champion;
}

/** '다시 보지 않기' — 그 대회의 우승 팝업을 이 기기에서 더 보이지 않게 한다. */
export function dismissCupChampion(cupId: string): void {
  try {
    storage().setItem(CUP_CHAMPION_SEEN, cupId);
  } catch {
    // 저장소를 못 쓰면 다음에 한 번 더 보인다.
  }
}
