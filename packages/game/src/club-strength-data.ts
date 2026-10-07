// T-11-135 현실 순위표로 갱신한 구단 전력표. 값은 club-strength.json — tooling/fulltime-sim/club-strength.ts가 만든다(손으로 고치지 않는다).
// v가 오르면 진행 중인 커리어는 다음 시즌 시작부터 이 값을 쓴다(clubStrength.ts). 여기 없는 구단은 data.ts 기본 전력.
import data from './club-strength.json';

export const CLUB_STRENGTH: {
  v: number;
  /** 반영한 현실 순위표 시점(KST 날짜)과 출처. */
  asOf: string;
  source: string;
  values: Record<string, number>;
} = data;
