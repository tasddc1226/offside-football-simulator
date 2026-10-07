// T-11-133 웹 잠재력 엿보기 기록(앱 platform/rewardedPeek.ts의 웹판). 자금을 내고 연 커리어 id + 시즌을 이 브라우저에만 둔다.
import { parsePeek, type PotentialPeek } from '@offside/app-core/potential-peek';

const KEY = 'ft_pot_peek';

export function loadPeek(): PotentialPeek | null {
  try {
    return parsePeek(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** 저장소를 못 써도(사생활 보호 모드) 화면에는 이번 방문 동안 열린 채로 둔다. */
export function savePeek(peek: PotentialPeek) {
  try {
    localStorage.setItem(KEY, JSON.stringify(peek));
  } catch {
    /* 무시 */
  }
}
