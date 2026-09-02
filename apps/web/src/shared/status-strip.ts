// 06 "점진적 공개": U18은 Base OVR·폼·체력만, 프로 계약 이후 전술 적합도·감독 신뢰가 늘어난다.
import type { CareerState } from '@offside/domain';
import type { StatusStripItem } from '@offside/ui';

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
