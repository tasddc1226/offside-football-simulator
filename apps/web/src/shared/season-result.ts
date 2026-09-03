// SCR-033 "시즌 변화·원인 태그" 접점(T-2-005): main에 `SeasonSummary.result: SeasonResult`가
// 머지됐다(PR #40, origin/main 확인). `seasonHistory`의 마지막 항목에서 `attributeDeltas`를 꺼내
// 원인 라벨과 함께 보여준다. `seasonHistory`가 비어 있으면(아직 시즌을 결산한 적 없음) null —
// SCR-033은 이 값이 null이면 "—"(미집계)로 표시한다.
import type { CareerState, GrowthCause } from '@offside/domain';

export const ATTRIBUTE_CHANGE_CAUSE_LABEL_KO: Record<GrowthCause, string> = {
  TRAINING: '훈련',
  MINUTES: '출전',
  EXPERIENCE: '경험',
  AGE_DECLINE: '연령',
  POTENTIAL_CAP: '잠재력 상한',
};

export type AttributeDelta = { key: string; delta: number; causes: GrowthCause[] };

export function latestSeasonResult(state: CareerState): { attributeDeltas: AttributeDelta[] } | null {
  const last = state.seasonHistory[state.seasonHistory.length - 1];
  if (last === undefined) return null;
  return {
    attributeDeltas: last.result.attributeDeltas.map((entry) => ({
      key: entry.key,
      delta: entry.delta,
      causes: entry.causes.map((cause) => cause.cause),
    })),
  };
}
