import type { CareerPhase, CareerState } from '@offside/domain';
import { evaluateCondition } from '../schema/condition.ts';
import type { EventDefinition } from '../schema/event.ts';
import type { ContentPack } from '../packs/load-content-pack.ts';
import { buildConditionContext } from './condition-context.ts';
import { annualStoryCandidates } from './annual-stories.ts';

export type EligibleEvent = {
  eventId: string;
  version: number;
  weight: number;
  slot?: 'TRANSFER_WINDOW';
};

const STEPS_PER_SEASON = 12;

/**
 * F2(T-4-015): 룰셋 1.0.0의 리그 캘린더는 `SeasonStep.phase`를 PRESEASON/LEAGUE/SETTLEMENT로만
 * 채운다 — `SeasonPhase.TRANSFER_WINDOW`는 어떤 step에도 나오지 않는다(step 7은 `phase: 'LEAGUE'`,
 * `windowOpen: true`). 이 때문에 `phases: ['TRANSFER_WINDOW']`인 이벤트(EVT-CON-010)는 이전
 * 매핑(`state.seasonPhase`만 보는 switch)에서 영원히 후보에 들지 못했다. `CareerPhase.TRANSFER_WINDOW`는
 * step의 `windowOpen` 플래그를 가리키는 별도 창이므로 season.phase 매핑보다 우선한다. domain 런타임
 * 함수(`findSeasonStep`)는 import할 수 없어(ADR-005) 같은 조회를 여기서 순수 함수로 복제한다.
 */
function isTransferWindowStep(state: CareerState): boolean {
  if (state.season === null) return false;
  const step = state.season.steps.find(
    (candidate) => candidate.index === state.season!.currentStep,
  );
  return step?.windowOpen ?? false;
}

function currentCareerPhase(state: CareerState): CareerPhase {
  if (state.stage === 'YOUTH') return 'YOUTH';
  if (isTransferWindowStep(state)) return 'TRANSFER_WINDOW';
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

/**
 * RUMOUR는 전용 pending 생성기가 아니라 step 7의 빈 재계약 pending을 결정 체크포인트로
 * 소비한다. 제안이 남은 CONTRACT나 다른 pending에서는 일반 이벤트 후보를 절대 열지 않는다.
 */
function isRumourCheckpoint(state: CareerState, phase: CareerPhase): boolean {
  return (
    phase === 'TRANSFER_WINDOW' &&
    state.pending?.kind === 'CONTRACT' &&
    state.pending.offers.length === 0
  );
}

function isWithinCooldown(event: EventDefinition, state: CareerState): boolean {
  const cooldown = event.cooldown;
  if (cooldown === undefined) return false;

  const lastResolvedIndex = findLastIndex(
    state.timeline,
    (entry) =>
      entry.kind === 'EVENT_RESOLVED' &&
      entry.refId !== null &&
      entry.refId.startsWith(`${event.id}:`),
  );
  if (lastResolvedIndex === -1) return false;
  const lastResolvedEntry = state.timeline[lastResolvedIndex];
  if (!lastResolvedEntry) return false;

  if (cooldown.steps !== undefined) {
    // career step은 시즌 경계에서 currentStep이 다시 시작하므로, 마지막 해소 뒤 결산 횟수를
    // 시즌당 12 step으로 환산해 같은 연속 시간축으로 만든다. 같은 시즌에는 기존 차이를 그대로 쓴다.
    const settledSeasons = state.timeline
      .slice(lastResolvedIndex + 1)
      .filter((entry) => entry.kind === 'SEASON_SETTLED').length;
    const elapsedCareerSteps =
      state.currentStep - lastResolvedEntry.step + settledSeasons * STEPS_PER_SEASON;
    return elapsedCareerSteps < cooldown.steps;
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
function passesBaseConditions(
  event: EventDefinition,
  state: CareerState,
  phase: CareerPhase,
): boolean {
  // T-4-003 D-52 정정: 전용 pending 생성기가 있는 presentation만 일반 슬롯에서 제외한다.
  // SLUMP·LOCKER_ROOM·ETHICS·MEDIA는 일반 EVENT와 같은 trigger/cooldown/followUp 경로를 탄다.
  // RUMOUR는 빈 CONTRACT 체크포인트에서만 같은 경로를 탄다.
  if (event.presentation === 'INJURY' || event.presentation === 'NATIONAL_TEAM') return false;
  if (event.presentation === 'RUMOUR' && !isRumourCheckpoint(state, phase)) return false;
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

function selectByTrigger(
  events: readonly EventDefinition[],
  state: CareerState,
  phase: CareerPhase,
): EventDefinition[] {
  const context = buildConditionContext(state);
  return events.filter(
    (event) =>
      passesBaseConditions(event, state, phase) && evaluateCondition(event.triggers, context),
  );
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
  const phase = currentCareerPhase(state);
  const rumourCheckpoint = isRumourCheckpoint(state, phase);
  if (state.status !== 'ACTIVE' || (state.pending !== null && !rumourCheckpoint)) return [];

  const followUpCandidates = resolveFollowUpCandidates(state, pack.eventsById, phase);
  const triggered = selectByTrigger(pack.events, state, phase);
  const usesBackgroundOpening =
    pack.manifest.contentPackVersion === '0.4.1' ||
    pack.manifest.contentPackVersion === '0.5.0' ||
    pack.manifest.contentPackVersion === '0.5.1';
  const firstContractRouteReady =
    usesBackgroundOpening &&
    state.contract === null &&
    state.stage === 'YOUTH' &&
    state.season === null &&
    state.seasonHistory.length === 0 &&
    (state.tags.includes('진로_아카데미') ||
      (state.tags.includes('진로_하부리그') && state.tags.includes('입단테스트_완료')) ||
      (state.tags.includes('진로_입단테스트') &&
        (state.tags.includes('테스트_성공') ||
          state.tags.includes('테스트_보통') ||
          state.tags.includes('테스트_실패'))));
  if (firstContractRouteReady && followUpCandidates.length === 0) return [];
  const openingEventId = usesBackgroundOpening
    ? ({ 'club-academy': 'EVT-CON-020', school: 'EVT-CON-021', street: 'EVT-CON-022' } as const)[
        state.player.profile?.backgroundId as 'club-academy' | 'school' | 'street'
      ]
    : pack.manifest.contentPackVersion === '0.4.0'
      ? 'EVT-CON-002'
      : undefined;
  const openingPath =
    openingEventId !== undefined && state.contract === null && state.seasonHistory.length === 0
      ? triggered.find((event) => event.id === openingEventId)
      : undefined;
  const pool =
    followUpCandidates.length > 0 ? followUpCandidates : openingPath ? [openingPath] : triggered;

  const localStories = ['0.10.0', '0.11.0', '0.12.0'].includes(pack.manifest.contentPackVersion)
    ? pool.filter((event) => /^EVT-REL-4[0-2][0-9]$/.test(event.id) || event.id === 'EVT-CON-310')
      : [];
  const result = (localStories.length > 0 ? localStories : pool)
    .filter((event) => pack.manifest.contentPackVersion !== '0.14.0' || !/^EVT-(DEV|MGR|REL)-14[0-5]$/.test(event.id))
    .map((event) => ({
      eventId: event.id,
      version: event.version,
      weight: event.weight,
      ...(event.presentation === 'RUMOUR' ? { slot: 'TRANSFER_WINDOW' as const } : {}),
    }))
    .sort(compareEventId);
  return [...result, ...annualStoryCandidates(pack, state)].sort(compareEventId);
}
