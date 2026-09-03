// SCR-033 "시즌 변화·원인 태그" 접점(T-2-005): `seasonHistory[].result: SeasonResult`는 T-2-005가
// domain에 붙인다. PR 시점에 `origin/main`을 합친 뒤에도 domain 타입에 그 필드가 없어(확인은 PR
// 본문에 기록) 항상 null을 돌려준다 — SCR-033은 이 값이 null이면 "—"(미집계)로 표시한다.
import type { CareerState } from '@offside/domain';

export type AttributeChangeCause = 'TRAINING' | 'MINUTES' | 'EXPERIENCE' | 'AGE_DECLINE' | 'POTENTIAL_CAP';

export const ATTRIBUTE_CHANGE_CAUSE_LABEL_KO: Record<AttributeChangeCause, string> = {
  TRAINING: '훈련',
  MINUTES: '출전',
  EXPERIENCE: '경험',
  AGE_DECLINE: '연령',
  POTENTIAL_CAP: '잠재력 상한',
};

export type AttributeDelta = { key: string; delta: number; causes: AttributeChangeCause[] };

export function latestSeasonResult(_state: CareerState): { attributeDeltas: AttributeDelta[] } | null {
  return null;
}
