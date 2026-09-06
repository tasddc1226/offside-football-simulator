// SCR-014: 직전 EVENT_RESOLVED 타임라인 항목(refId = eventId:choiceId:outcomeId)만으로 결과를
// 재구성한다. appliedEffects(휘발성 mutation 응답)가 아니라 팩의 outcome 정의를 읽으므로, 새로고침·
// 뒤로 가기로 같은 rev를 다시 열어도 같은 문장을 돌려준다(결정론).
import type { CareerState } from '@offside/domain';
import type { ContentPack } from '@offside/content';
import { formatEffectSummary } from './effect-summary.js';
import { EFFECT_TARGET_LABEL_KO, OUTCOME_KIND_LABEL_KO, resultTagLabel } from './labels.js';
import { eventOutcomeTitle } from './legacy-event-copy.js';

export type EventResultView = {
  kind: 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED';
  kindLabel: string;
  title: string;
  body: string;
  effects: string[];
  tags: string[];
};

/**
 * 내부 태그 ID를 결과 카드용 한국어 라벨로 바꾼다(labels.ts의 RESULT_TAG_LABEL_KO 카탈로그를
 * 그대로 쓴다 — 챕터 결과 카드와 같은 표). 카탈로그에 없는 태그는 원문을 노출하지 않도록 null을
 * 돌려주고, 호출부(event_.result.tsx)가 null을 걸러 화면에서 숨긴다.
 */
export function eventResultTagLabel(tagId: string): string | null {
  return resultTagLabel(tagId);
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
