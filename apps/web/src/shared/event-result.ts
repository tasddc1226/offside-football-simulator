// SCR-014: 직전 EVENT_RESOLVED 타임라인 항목(refId = eventId:choiceId:outcomeId)만으로 결과를
// 재구성한다. appliedEffects(휘발성 mutation 응답)가 아니라 팩의 outcome 정의를 읽으므로, 새로고침·
// 뒤로 가기로 같은 rev를 다시 열어도 같은 문장을 돌려준다(결정론).
import type { CareerState } from '@offside/domain';
import type { ContentPack } from '@offside/content';
import { formatEffectSummary } from './effect-summary.js';
import { EFFECT_TARGET_LABEL_KO, OUTCOME_KIND_LABEL_KO } from './labels.js';
import { eventOutcomeTitle } from './legacy-event-copy.js';

export type EventResultView = {
  kind: 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED';
  kindLabel: string;
  title: string;
  body: string;
  effects: string[];
  tags: string[];
};

/** 결과 카드에서만 사용하는 태그 라벨. 저장·라우팅에는 내부 태그 ID를 그대로 사용한다. */
export const EVENT_RESULT_TAG_LABELS: Record<string, string> = {
  '진로_아카데미_평가': '아카데미 평가 경로',
  '진로_아카데미_이동탐색': '아카데미 이동 탐색 경로',
  '진로_학교_성인훈련': '학교·성인 훈련 경로',
  '진로_학교_상위테스트': '학교·상위 테스트 경로',
  '진로_지역_준비': '지역 리그 준비 경로',
  '진로_지역_이동훈련': '지역 리그 이동 훈련 경로',
  '진로_아카데미': '아카데미 경로',
  '진로_하부리그': '하부 리그 경로',
  '진로_입단테스트': '입단 테스트 경로',
  입단테스트_완료: '입단 테스트 완료',
  테스트_성공: '테스트 성공',
  테스트_보통: '테스트 보통',
  테스트_실패: '테스트 실패',
  역할_시험_협의: '역할 시험 협의 중',
  역할_기존장점_증명: '기존 장점 증명 중',
  역할_협의_완료: '역할 협의 완료',
};

/** 내부 태그 ID를 결과 카드용 문구로 바꾼다. 새 태그도 밑줄을 공백으로 읽을 수 있게 표시한다. */
export function eventResultTagLabel(tagId: string): string {
  return EVENT_RESULT_TAG_LABELS[tagId] ?? tagId.replaceAll('_', ' ');
}

/** 결과 직전/직후 저장값의 차이. 상한·중복 적용과 대표팀 자동 효과까지 포함한다. */
export function actualEventEffects(before: CareerState, after: CareerState): string[] {
  const changes: string[] = [];
  for (const bag of ['attributes', 'state', 'context', 'relationships', 'reputation'] as const) {
    const previous = before[bag] as Record<string, number>;
    for (const [key, value] of Object.entries(after[bag])) {
      const delta = value - (previous[key] ?? value);
      if (delta === 0) continue;
      const target = key === 'popularityCenti' ? 'popularity' : key === 'mediaCenti' ? 'media' : key;
      const label = EFFECT_TARGET_LABEL_KO[target as keyof typeof EFFECT_TARGET_LABEL_KO] ?? target;
      const amount = bag === 'reputation' ? delta / 100 : delta;
      changes.push(`${label} ${amount > 0 ? '+' : ''}${amount}`);
    }
  }
  return changes;
}

export function resolveEventResultView(state: CareerState, pack: ContentPack, rev: number): EventResultView | null {
  const entry = state.timeline.find((candidate) => candidate.revision === rev && candidate.kind === 'EVENT_RESOLVED');
  if (entry === undefined || entry.refId === null) return null;

  const [eventId, choiceId, outcomeId] = entry.refId.split(':');
  if (eventId === undefined || choiceId === undefined || outcomeId === undefined) return null;

  const definition = pack.eventsById.get(eventId);
  const choice = definition?.choices.find((candidate) => candidate.id === choiceId);
  const outcome = choice?.outcomes.find((candidate) => candidate.id === outcomeId);
  if (definition === undefined || choice === undefined || outcome === undefined) return null;

  return {
    kind: outcome.kind,
    kindLabel: OUTCOME_KIND_LABEL_KO[outcome.kind],
    title: eventOutcomeTitle(definition, outcome),
    body: choice.label,
    effects: outcome.effects.map(formatEffectSummary),
    tags: outcome.addTags ?? [],
  };
}
