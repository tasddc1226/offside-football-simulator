// SCR-014: 직전 EVENT_RESOLVED 타임라인 항목(refId = eventId:choiceId:outcomeId)만으로 결과를
// 재구성한다. appliedEffects(휘발성 mutation 응답)가 아니라 팩의 outcome 정의를 읽으므로, 새로고침·
// 뒤로 가기로 같은 rev를 다시 열어도 같은 문장을 돌려준다(결정론).
import type { CareerState } from '@offside/domain';
import type { ContentPack } from '@offside/content';
import { formatEffectSummary } from './effect-summary.js';
import { OUTCOME_KIND_LABEL_KO } from './labels.js';

export type EventResultView = {
  kind: 'SUCCESS' | 'NEUTRAL' | 'FAIL' | 'FIXED';
  kindLabel: string;
  title: string;
  body: string;
  effects: string[];
  tags: string[];
};

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
    title: outcome.title,
    body: choice.label,
    effects: outcome.effects.map(formatEffectSummary),
    tags: outcome.addTags ?? [],
  };
}
