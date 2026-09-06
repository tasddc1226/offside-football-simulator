// 06 "점진적 공개": U18은 Base OVR·폼·체력만, 프로 계약 이후 전술 적합도·감독 신뢰가 늘어난다.
import type { CareerState } from '@offside/domain';
import type { StatusStripItem } from '@offside/ui';
import { relationTierLabel } from './labels.js';

export function u18StatusStripItems(state: CareerState): StatusStripItem[] {
  return [
    { id: 'baseOvr', label: '기본 OVR', value: state.player.profile?.baseOvr ?? 0 },
    { id: 'form', label: '폼', value: state.state.form },
    { id: 'fitness', label: '체력', value: state.state.fitness },
  ];
}

export function proStatusStripItems(state: CareerState): StatusStripItem[] {
  return [
    ...u18StatusStripItems(state),
    { id: 'tacticalFit', label: '전술 적합도', value: state.context.tacticalFit },
    { id: 'managerTrust', label: '감독 신뢰', value: state.relationships.managerTrust },
  ];
}

export type ConditionTileItem = {
  id: 'form' | 'fitness' | 'morale';
  label: string;
  /** 0~100(packages/domain/src/condition.ts가 매 step clamp한다) — 여기서 새로 계산하지 않는다. */
  value: number;
  /** "매우 낮음·낮음"(관계 5단계 경계 재사용, labels.ts) 구간이면 세워 색 대신 라벨·아이콘도 같이
   * 보여줄 수 있게 한다(색약 대응). */
  low: boolean;
  tierLabel: string;
};

/** UX-007 홈 탭 "컨디션" 타일: 폼·체력·사기 모두 `CareerState.state`에 이미 있는 값이라 새 도메인
 * 계산이 없다. 다른 화면(StatusStrip 기반)과 달리 첫 항목을 액센트로 강조하지 않는다 — 동일한
 * 스타일의 타일 + 미터로 위계를 통일한다. */
export function conditionTileItems(state: CareerState): ConditionTileItem[] {
  const entries: Array<{ id: ConditionTileItem['id']; label: string; value: number }> = [
    { id: 'form', label: '폼', value: state.state.form },
    { id: 'fitness', label: '체력', value: state.state.fitness },
    { id: 'morale', label: '사기', value: state.state.morale },
  ];
  return entries.map((entry) => ({
    ...entry,
    low: entry.value < 40,
    tierLabel: relationTierLabel(entry.value),
  }));
}
