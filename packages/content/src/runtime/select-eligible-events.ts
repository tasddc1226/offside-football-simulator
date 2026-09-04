import type { CareerPhase, CareerState } from '@offside/domain';
import { evaluateCondition } from '../schema/condition.ts';
import type { EventDefinition } from '../schema/event.ts';
import type { ContentPack } from '../packs/load-content-pack.ts';
import { buildConditionContext } from './condition-context.ts';

export type EligibleEvent = { eventId: string; version: number; weight: number };

function currentCareerPhase(state: CareerState): CareerPhase {
  if (state.stage === 'YOUTH') return 'YOUTH';
  switch (state.seasonPhase) {
    case 'PRESEASON':
      return 'PRESEASON';
    case 'LEAGUE':
    case 'CUP':
      return 'IN_SEASON';
    case 'TRANSFER_WINDOW':
      return 'TRANSFER_WINDOW';
    case 'SETTLEMENT':
      return 'SETTLEMENT';
  }
}

function isWithinCooldown(event: EventDefinition, state: CareerState): boolean {
  const cooldown = event.cooldown;
  if (cooldown === undefined) return false;

  const lastResolvedIndex = findLastIndex(
    state.timeline,
    (entry) => entry.kind === 'EVENT_RESOLVED' && entry.refId !== null && entry.refId.startsWith(`${event.id}:`),
  );
  if (lastResolvedIndex === -1) return false;
  const lastResolvedEntry = state.timeline[lastResolvedIndex];
  if (!lastResolvedEntry) return false;

  if (cooldown.steps !== undefined) {
    return state.currentStep - lastResolvedEntry.step < cooldown.steps;
  }
  if (cooldown.seasons !== undefined) {
    const seasonsElapsed = state.timeline
      .slice(lastResolvedIndex + 1)
      .filter((entry) => entry.kind === 'SEASON_SETTLED').length;
    return seasonsElapsed < cooldown.seasons;
  }
  return false;
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return index;
  }
  return -1;
}

/**
 * `resolvedEventIds`에 있으면 기본적으로 영구 제외(1회성)한다. `cooldown`이 있는 이벤트만
 * 예외로, 04 이벤트 엔진 문서의 쿨다운 규칙(steps 또는 seasons 경과)을 지나면 다시 노출한다.
 */
function isBlockedByResolution(event: EventDefinition, state: CareerState): boolean {
  if (!state.resolvedEventIds.includes(event.id)) return false;
  if (event.cooldown === undefined) return true;
  return isWithinCooldown(event, state);
}

/** 단계·나이·제외 태그·해소 여부. followUp 후보와 일반 후보가 공통으로 통과해야 하는 조건이다. */
function passesBaseConditions(event: EventDefinition, state: CareerState, phase: CareerPhase): boolean {
  // T-4-003 D-52 정정: 전용 pending 생성기가 있는 presentation만 일반 슬롯에서 제외한다.
  // SLUMP·LOCKER_ROOM·ETHICS·MEDIA는 일반 EVENT와 같은 trigger/cooldown/followUp 경로를 탄다.
  if (event.presentation === 'INJURY' || event.presentation === 'NATIONAL_TEAM' || event.presentation === 'RUMOUR') return false;
  if (!event.phases.includes(phase)) return false;
  if (event.minAge !== undefined && state.age < event.minAge) return false;
  if (event.maxAge !== undefined && state.age > event.maxAge) return false;
  if (event.exclusionTags.some((tag) => state.tags.includes(tag))) return false;
  if (isBlockedByResolution(event, state)) return false;
  return true;
}

/**
 * `state.timeline`의 마지막 `EVENT_RESOLVED`가 남긴 followUps 중 기본 조건을 통과하는 이벤트.
 * followUp은 트리거 조건을 보지 않는다(문서화된 예외: 04 이벤트 엔진 문서 D-10 처리 순서).
 */
function resolveFollowUpCandidates(
  state: CareerState,
  eventsById: ReadonlyMap<string, EventDefinition>,
  phase: CareerPhase,
): EventDefinition[] {
  const lastResolved = findLastIndex(state.timeline, (entry) => entry.kind === 'EVENT_RESOLVED');
  if (lastResolved === -1) return [];
  const entry = state.timeline[lastResolved];
  if (!entry || entry.refId === null) return [];

  const [eventId, choiceId, outcomeId] = entry.refId.split(':');
  if (!eventId || !choiceId || !outcomeId) return [];

  const resolvedEvent = eventsById.get(eventId);
  const choice = resolvedEvent?.choices.find((c) => c.id === choiceId);
  const outcome = choice?.outcomes.find((o) => o.id === outcomeId);
  const followUps = outcome?.followUps ?? [];

  const candidates: EventDefinition[] = [];
  for (const followUp of followUps) {
    const candidate = eventsById.get(followUp.eventId);
    if (candidate && passesBaseConditions(candidate, state, phase)) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

function selectByTrigger(events: readonly EventDefinition[], state: CareerState, phase: CareerPhase): EventDefinition[] {
  const context = buildConditionContext(state);
  return events.filter((event) => passesBaseConditions(event, state, phase) && evaluateCondition(event.triggers, context));
}

function compareEventId(a: EligibleEvent, b: EligibleEvent): number {
  if (a.eventId < b.eventId) return -1;
  if (a.eventId > b.eventId) return 1;
  return 0;
}

/**
 * `state`에서 지금 제시 가능한 이벤트 목록을 eventId 오름차순으로 돌려준다.
 * 도메인의 `ADVANCE`가 이 목록에서 가중 선택으로 하나를 고른다(선택은 도메인의 몫).
 */
export function selectEligibleEvents(pack: ContentPack, state: CareerState): EligibleEvent[] {
  if (state.status !== 'ACTIVE' || state.pending !== null) return [];

  const phase = currentCareerPhase(state);

  const followUpCandidates = resolveFollowUpCandidates(state, pack.eventsById, phase);
  const pool = followUpCandidates.length > 0 ? followUpCandidates : selectByTrigger(pack.events, state, phase);

  return pool
    .map((event) => ({ eventId: event.id, version: event.version, weight: event.weight }))
    .sort(compareEventId);
}
