import { compareCodePoints } from './canonical.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type CareerState, type Effect, type InjuryEpisode } from './types.js';

const CURRENT_KEYS = ['form', 'fitness', 'morale'] as const;
const CONTEXT_KEYS = ['tacticalFit', 'squadStatus', 'positionProficiency'] as const;
const RELATION_KEYS = ['managerTrust', 'captain', 'rival', 'fans', 'agent'] as const;
// T-4-001 D-49: RELATION이 다루는 두 번째 bag(평판). 타깃 이름(popularity/media)은 실제 state 필드
// 이름(popularityCenti/mediaCenti)과 달라 REPUTATION_FIELD로 옮긴다.
const REPUTATION_KEYS = ['popularity', 'media'] as const;
const REPUTATION_FIELD = { popularity: 'popularityCenti', media: 'mediaCenti' } as const;

type FieldBag = 'attributes' | 'state' | 'context' | 'relationships' | 'reputation' | null;

// T-4-001 D-49: RELATION은 타깃에 따라 relationships(기존 5축) 또는 reputation(popularity/media) 두
// bag 중 하나를 쓴다 — kind만으로는 bag을 정할 수 없어 target도 받는다. HEALTH는 이 네·다섯 bag
// 어디에도 속하지 않는 별도 경로(season.availability·health.episodes)라 null을 돌려준다.
function bagForKind(kind: Effect['kind'], target: string): FieldBag {
  switch (kind) {
    case 'PERMANENT':
      return 'attributes';
    case 'CURRENT':
      return 'state';
    case 'CONTEXT':
      return 'context';
    case 'RELATION':
      return (REPUTATION_KEYS as readonly string[]).includes(target) ? 'reputation' : 'relationships';
    case 'DEFERRED':
    case 'HEALTH':
      return null;
  }
}

function isValidTarget(bag: Exclude<FieldBag, null>, target: string): boolean {
  switch (bag) {
    case 'attributes':
      return (ATTRIBUTE_KEYS as readonly string[]).includes(target);
    case 'state':
      return (CURRENT_KEYS as readonly string[]).includes(target);
    case 'context':
      return (CONTEXT_KEYS as readonly string[]).includes(target);
    case 'relationships':
      return (RELATION_KEYS as readonly string[]).includes(target);
    case 'reputation':
      return (REPUTATION_KEYS as readonly string[]).includes(target);
  }
}

/** bag 안에서 실제로 읽고 쓸 필드 이름. reputation만 타깃 이름과 필드 이름이 다르다. */
function bagFieldFor(bag: Exclude<FieldBag, null>, target: string): string {
  return bag === 'reputation' ? REPUTATION_FIELD[target as keyof typeof REPUTATION_FIELD] : target;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type EffectBags = {
  attributes: Record<AttributeKey, number>;
  state: { form: number; fitness: number; morale: number };
  context: { tacticalFit: number; squadStatus: number; positionProficiency: number };
  relationships: { managerTrust: number; captain: number; rival: number; fans: number; agent: number };
  reputation: { popularityCenti: number; mediaCenti: number };
};

function cloneBags(state: CareerState): EffectBags {
  return {
    attributes: { ...state.attributes },
    state: { ...state.state },
    context: { ...state.context },
    relationships: { ...state.relationships },
    reputation: { ...state.reputation },
  };
}

function bagObjFor(bags: EffectBags, bag: Exclude<FieldBag, null>): Record<string, number> {
  switch (bag) {
    case 'attributes':
      return bags.attributes as Record<string, number>;
    case 'state':
      return bags.state as Record<string, number>;
    case 'context':
      return bags.context as Record<string, number>;
    case 'relationships':
      return bags.relationships as Record<string, number>;
    case 'reputation':
      return bags.reputation as Record<string, number>;
  }
}

/** T-4-001 D-49: "활성 에피소드" = status가 ACTIVE 또는 REHAB인 것 중 배열 마지막 항목. 없으면 -1. */
function findActiveEpisodeIndex(episodes: readonly InjuryEpisode[]): number {
  for (let i = episodes.length - 1; i >= 0; i--) {
    const status = episodes[i]!.status;
    if (status === 'ACTIVE' || status === 'REHAB') return i;
  }
  return -1;
}

/**
 * D-40 규칙 2: `stackingRule`이 커리어 전체 1회(`ONCE_PER_SOURCE`)면 `sourceId` 그대로, 시즌마다
 * 1회(`ONCE_PER_SEASON`)면 `season:<index>:<sourceId>`가 `appliedSourceIds`의 중복 검사 키다. 시즌이
 * 없을 때(유스 구간 등 `state.season === null`) 적용되는 `ONCE_PER_SEASON`은 실질적으로 "그 시즌 배정
 * 전에 한 번뿐"이라 index 0(실제 시즌 index는 항상 1부터라 절대 다시 매칭되지 않는다)을 쓴다.
 */
function dedupeKeyFor(state: CareerState, effect: Effect): string | null {
  if (effect.stackingRule === 'ONCE_PER_SOURCE') return effect.sourceId;
  if (effect.stackingRule === 'ONCE_PER_SEASON') return `season:${state.season?.index ?? 0}:${effect.sourceId}`;
  return null;
}

/**
 * D-40 규칙 3: `activeEffects`에 저장하기 직전, 상대 표기(`STEPS_AFTER`·`SEASONS_AFTER`)를 절대 표기
 * (`AT_STEP`·`AT_SEASON_INDEX`)로 치환한다. `SEASONS_AFTER`는 시즌이 없으면(유스 구간) 0을 기준으로
 * 삼는다(`dedupeKeyFor`의 시즌 0 관례와 같다). `expireAtSeasonEnd`가 `AT_SEASON_INDEX`를 `<=`로
 * 비교하므로(R2-1), 이렇게 저장된 index 0짜리 효과는 영원히 남지 않고 첫 시즌 결산(seasonIndex 1)에서
 * 만료된다 — "실제 시즌 index는 1부터라 절대 되돌아오지 않는다"는 옛 가정은 틀렸다.
 */
function resolveExpiresAtForStorage(
  expiresAt: Exclude<Effect['expiresAt'], null>,
  state: CareerState,
  now: { step: number },
): Exclude<Effect['expiresAt'], null> {
  if (expiresAt.kind === 'STEPS_AFTER') return { kind: 'AT_STEP', step: now.step + expiresAt.steps };
  if (expiresAt.kind === 'SEASONS_AFTER') return { kind: 'AT_SEASON_INDEX', index: (state.season?.index ?? 0) + expiresAt.seasons };
  return expiresAt;
}

export type RejectedEffect = { effect: Effect; reason: string };

export type ApplyEffectsResult = {
  state: CareerState;
  applied: Effect[];
  rejected: RejectedEffect[];
};

/**
 * Effect 목록을 순서대로 적용한다. RELATION·CONTEXT는 attributes를 바꿀 수 없고,
 * PERMANENT만 attributes를 바꾼다. `ONCE_PER_SOURCE`·`ONCE_PER_SEASON`은 `dedupeKeyFor`가 이미
 * `appliedSourceIds`에 있으면 reject한다. expiresAt이 있는 효과는 `activeEffects`에 기록해 만료 시
 * 되돌릴 수 있게 한다 — D-40 규칙 4: `REPLACE`는 적용 전 원래 값을 `restoreTo`에 함께 저장한다(만료
 * 시 `−delta`가 아니라 이 값으로 복원해야 하므로).
 *
 * T-4-001 D-49: HEALTH는 4(+reputation)bag 밖의 `season.availability`·`health.episodes`를 갱신하는
 * 별도 경로다 — `activeEffects`에 저장하지 않는다(적용 즉시 소멸, `stackingRule: 'SUM'`·
 * `appliesAt: IMMEDIATE`·`expiresAt: null`만 허용, 아니면 reason `HEALTH_RULE`로 reject).
 */
export function applyEffects(state: CareerState, effects: Effect[], now: { step: number }): ApplyEffectsResult {
  const bags = cloneBags(state);
  const appliedSourceIds = [...state.appliedSourceIds];
  const activeEffects = [...state.activeEffects];
  const deferredEffects = [...state.deferredEffects];
  let health = state.health;
  let availability = state.season?.availability ?? null;

  const applied: Effect[] = [];
  const rejected: RejectedEffect[] = [];

  for (const effect of effects) {
    const dedupeKey = dedupeKeyFor(state, effect);
    if (dedupeKey !== null && appliedSourceIds.includes(dedupeKey)) {
      rejected.push({ effect, reason: `${effect.stackingRule}_DUPLICATE` });
      continue;
    }

    if (effect.kind === 'DEFERRED') {
      deferredEffects.push(effect);
      applied.push(effect);
      if (dedupeKey !== null) appliedSourceIds.push(dedupeKey);
      continue;
    }

    if (effect.kind === 'HEALTH') {
      if (effect.stackingRule !== 'SUM' || effect.appliesAt.kind !== 'IMMEDIATE' || effect.expiresAt !== null) {
        rejected.push({ effect, reason: 'HEALTH_RULE' });
        continue;
      }
      if (effect.target === 'availability.matchesRemaining') {
        if (availability === null || availability.kind !== 'INJURY') {
          rejected.push({ effect, reason: 'NO_ACTIVE_INJURY' });
          continue;
        }
        availability = {
          ...availability,
          matchesRemaining: clampValue(availability.matchesRemaining + effect.delta, effect.clamp.min, effect.clamp.max),
        };
        applied.push(effect);
        if (dedupeKey !== null) appliedSourceIds.push(dedupeKey);
        continue;
      }
      if (effect.target === 'health.recurrenceRiskBp') {
        const activeIndex = findActiveEpisodeIndex(health.episodes);
        if (activeIndex === -1) {
          rejected.push({ effect, reason: 'NO_ACTIVE_EPISODE' });
          continue;
        }
        const episode = health.episodes[activeIndex]!;
        const nextRisk = clampValue(episode.recurrenceRiskBp + effect.delta, effect.clamp.min, effect.clamp.max);
        health = { episodes: health.episodes.map((candidate, i) => (i === activeIndex ? { ...candidate, recurrenceRiskBp: nextRisk } : candidate)) };
        applied.push(effect);
        if (dedupeKey !== null) appliedSourceIds.push(dedupeKey);
        continue;
      }
      rejected.push({ effect, reason: `INVALID_TARGET_FOR_KIND:HEALTH:${effect.target}` });
      continue;
    }

    const bag = bagForKind(effect.kind, effect.target);
    if (bag === null || !isValidTarget(bag, effect.target)) {
      rejected.push({ effect, reason: `INVALID_TARGET_FOR_KIND:${effect.kind}:${effect.target}` });
      continue;
    }

    const bagObj = bagObjFor(bags, bag);
    const key = bagFieldFor(bag, effect.target);
    const previousValue = bagObj[key] as number;
    const nextValue = effect.stackingRule === 'REPLACE' ? effect.delta : previousValue + effect.delta;
    bagObj[key] = clampValue(nextValue, effect.clamp.min, effect.clamp.max);

    applied.push(effect);
    if (dedupeKey !== null) appliedSourceIds.push(dedupeKey);

    if (effect.expiresAt !== null) {
      const resolvedExpiresAt = resolveExpiresAtForStorage(effect.expiresAt, state, now);
      const storedEffect: Effect = {
        ...effect,
        expiresAt: resolvedExpiresAt,
        ...(effect.stackingRule === 'REPLACE' ? { restoreTo: previousValue } : {}),
      };
      activeEffects.push(storedEffect);
    }
  }

  return {
    state: {
      ...state,
      attributes: bags.attributes,
      state: bags.state,
      context: bags.context,
      relationships: bags.relationships,
      reputation: bags.reputation,
      health,
      season: state.season === null ? null : { ...state.season, availability },
      appliedSourceIds: appliedSourceIds.sort(compareCodePoints),
      activeEffects,
      deferredEffects,
    },
    applied,
    rejected,
  };
}

export type ResolvedDeferredKind = { kind: Exclude<Effect['kind'], 'DEFERRED'>; target: string };

/**
 * T-2-005 D-39: DEFERRED 효과의 `target` 접두사로 실제 kind를 되돌린다 — `state.*`는 CURRENT,
 * `relationships.*`·`reputation.*`(T-4-001 D-49)는 RELATION, `context.*`는 CONTEXT, 그 외(접두사
 * 없는 속성 키)는 PERMANENT.
 */
export function resolveDeferredKind(target: string): ResolvedDeferredKind {
  if (target.startsWith('state.')) return { kind: 'CURRENT', target: target.slice('state.'.length) };
  if (target.startsWith('relationships.')) return { kind: 'RELATION', target: target.slice('relationships.'.length) };
  if (target.startsWith('reputation.')) return { kind: 'RELATION', target: target.slice('reputation.'.length) };
  if (target.startsWith('context.')) return { kind: 'CONTEXT', target: target.slice('context.'.length) };
  return { kind: 'PERMANENT', target };
}

/**
 * T-2-005 D-39, 오케스트레이터 리뷰 2차(R2-1)로 정정: DEFERRED 효과는 시즌 step 번호로만 해석할 수
 * 있으므로 `state.deferredEffects`(season 없이 미룬 것들의 대기열)가 아니라 `state.season.scheduledEffects`
 * (이번 시즌에 적용 예정인 목록 — `startSeason`이 `state.deferredEffects`를 옮겨 채운다)를 읽는다.
 * `step`에 도달한 항목(`appliesAt.kind === 'NEXT_SEASON_STEP'`이고 `appliesAt.step === step`)을
 * `resolveDeferredKind`로 실제 kind로 되돌려 `applyEffects`로 적용하고 `scheduledEffects`에서
 * 제거한다. `season`이 없으면(유스 구간 등) no-op — 그 사이 미룬 효과는 `state.deferredEffects`에
 * 그대로 쌓여 있다가 다음 `START_SEASON`에서 옮겨진다. 스키마가 허용하지 않는 target은 `applyEffects`가
 * 그대로 reject한다(기존 관례대로 조용히 무시 — throw하지 않는다).
 */
export function resolveDeferredEffects(state: CareerState, step: number): CareerState {
  const season = state.season;
  if (season === null) return state;

  const due = season.scheduledEffects.filter(
    (effect) => effect.appliesAt.kind === 'NEXT_SEASON_STEP' && effect.appliesAt.step === step,
  );
  if (due.length === 0) return state;

  const remaining = season.scheduledEffects.filter((effect) => !due.includes(effect));
  const resolvedEffects: Effect[] = due.map((effect) => {
    const resolved = resolveDeferredKind(effect.target);
    return { ...effect, kind: resolved.kind, target: resolved.target, appliesAt: { kind: 'IMMEDIATE' } };
  });

  return applyEffects({ ...state, season: { ...season, scheduledEffects: remaining } }, resolvedEffects, { step }).state;
}

/**
 * D-40 규칙 4: 활성 효과 하나를 되돌린다. `SUM`은 `−delta`, `REPLACE`는 적용 전 저장해 둔
 * `restoreTo`(없으면 방어적으로 현재 값 유지)로 복원한다 — 둘 다 clamp를 다시 건다.
 */
function revertOne(effect: Effect, bags: EffectBags): void {
  const bag = bagForKind(effect.kind, effect.target);
  if (bag === null) return;
  const bagObj = bagObjFor(bags, bag);
  const key = bagFieldFor(bag, effect.target);
  const currentValue = bagObj[key] as number;
  const restored = effect.stackingRule === 'REPLACE' ? (effect.restoreTo ?? currentValue) : currentValue - effect.delta;
  bagObj[key] = clampValue(restored, effect.clamp.min, effect.clamp.max);
}

/** `AT_STEP`에 도달한 활성 효과를 되돌리고(clamp 적용) `activeEffects`에서 제거한다. */
export function expireEffects(state: CareerState, step: number): CareerState {
  const bags = cloneBags(state);
  const remaining: Effect[] = [];

  for (const effect of state.activeEffects) {
    const expiresAt = effect.expiresAt;
    const shouldExpire = expiresAt !== null && expiresAt.kind === 'AT_STEP' && step >= expiresAt.step;
    if (!shouldExpire) {
      remaining.push(effect);
      continue;
    }
    revertOne(effect, bags);
  }

  return {
    ...state,
    attributes: bags.attributes,
    state: bags.state,
    context: bags.context,
    relationships: bags.relationships,
    reputation: bags.reputation,
    activeEffects: remaining,
  };
}

/**
 * D-40 규칙 3: 시즌 결산 직전에만 부른다(`expireEffects`가 걷기의 step 진입 시 부르는 것과 짝).
 * 세 가지를 되돌린다 — `AT_SEASON_END`(항상), `AT_SEASON_INDEX`(그 `index`가 지금 결산하는
 * `seasonIndex` 이하일 때 — 아직 멀었으면 다음 시즌들로 넘어간다), 그리고 시즌 안에서 자연 만료되지
 * 못하고 남은 `AT_STEP`(정의상 시즌을 넘겨 만료되는 게 아니라 결산 시 강제 만료된다 — "시즌 경계를
 * 넘는 AT_STEP은 다음 시즌의 같은 step에서 만료된다고 정의하지 않는다"). `AT_SEASON_INDEX`를 `===`가
 * 아니라 `<=`로 비교하는 이유(R2-1): `index`가 이미 지난 경우(예: 유스 구간에서 저장된 index 0, 또는
 * 어떤 경로로든 그 시즌 결산을 건너뛴 경우)에도 다음 결산에서 반드시 되돌아와야 하고, 영원히
 * `activeEffects`에 남아서는 안 된다.
 */
export function expireAtSeasonEnd(state: CareerState, seasonIndex: number): CareerState {
  const bags = cloneBags(state);
  const remaining: Effect[] = [];

  for (const effect of state.activeEffects) {
    const expiresAt = effect.expiresAt;
    const shouldExpire =
      expiresAt !== null &&
      (expiresAt.kind === 'AT_STEP' || expiresAt.kind === 'AT_SEASON_END' || (expiresAt.kind === 'AT_SEASON_INDEX' && expiresAt.index <= seasonIndex));
    if (!shouldExpire) {
      remaining.push(effect);
      continue;
    }
    revertOne(effect, bags);
  }

  return {
    ...state,
    attributes: bags.attributes,
    state: bags.state,
    context: bags.context,
    relationships: bags.relationships,
    reputation: bags.reputation,
    activeEffects: remaining,
  };
}
