import type { EventDefinition } from '@offside/content';

// 0.1.0/0.2.0 팩은 체크섬으로 저장·재생에 고정되어 있다. 구판 문구만 화면에서 보정하며
// 이벤트 버전과 원문을 함께 대조해 이후 콘텐츠 개정판을 덮어쓰지 않는다.
const LEGACY_PATH_SITUATION = '시즌이 끝났다. 정찰 범위 68~82. 눈앞에 네 갈래 길이 있다. 어느 길도 정답이 아니며 각 경로는 다른 것을 준다.';
const LEGACY_TRYOUT_SITUATION = '결과는 화면 진입 전에 확정한다. 제안 수 = 기본 1 + (챕터 활약 2회 이상 1) + (태그 `에이전트_계약` 1) + (태그 `주목받는_유망주` 1), 최대 3.';

export function eventSituation(definition: EventDefinition): string {
  const original = definition.narrative.situation;
  if (definition.version !== 1) return original;
  if (definition.id === 'EVT-CON-002' && original === LEGACY_PATH_SITUATION) {
    // 정찰 범위는 SCR-007의 실제 선수 정보 구역에서만 표시한다. 선택지 수를 중복 하드코딩하지 않는다.
    return '다음 무대로 향할 길을 선택할 시간이다. 어느 길도 정답은 아니며, 각 경로는 서로 다른 기회를 준다.';
  }
  if (definition.id === 'EVT-CON-003' && original === LEGACY_TRYOUT_SITUATION) {
    return '입단 테스트에서 갈고닦은 실력을 보여줄 시간이다. 너의 플레이를 지켜보는 구단 관계자들 앞에서 어떤 모습을 보여줄까?';
  }
  return original;
}

export function eventOutcomeTitle(definition: EventDefinition, outcome: { title: string }): string {
  if (definition.version === 1 && definition.id === 'EVT-CON-002') {
    if (outcome.title === 'EVT-P10 즉시 진행') return '프로 입단 테스트에 도전한다';
    if (outcome.title === 'EVT-P10을 2부·3부 제안으로 고정') return '하부리그에서 첫 기회를 찾는다';
  }
  return outcome.title;
}
