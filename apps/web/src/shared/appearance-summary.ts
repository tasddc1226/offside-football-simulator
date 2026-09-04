import type { SeasonPlayerStats } from '@offside/domain';

/** 저장 집계의 total은 팀 경기 수, sub는 미사용 교체 명단까지 포함한다.
 * 룰셋 1.0.0의 선발은 항상 60분 이상이므로 zeroMinute - out은 미사용 교체 수다.
 * 새 룰셋에서 0분 선발을 허용하면 선발/교체별 0분 집계를 추가해야 한다(회귀 테스트로 고정).
 * 원본 집계·정산 해시는 변경하지 않는다.
 */
export function appearanceSummary(counts: SeasonPlayerStats['appearances']): SeasonPlayerStats['appearances'] {
  return {
    ...counts,
    total: counts.total - counts.zeroMinute,
    sub: counts.sub - (counts.zeroMinute - counts.out),
  };
}
