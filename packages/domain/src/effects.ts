import { compareCodePoints } from './canonical.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type CareerState, type Effect } from './types.js';

const CURRENT_KEYS = ['form', 'fitness', 'morale'] as const;
const CONTEXT_KEYS = ['tacticalFit', 'squadStatus', 'positionProficiency'] as const;
const RELATION_KEYS = ['managerTrust', 'captain', 'rival', 'fans', 'agent'] as const;

type FieldBag = 'attributes' | 'state' | 'context' | 'relationships' | null;

function bagForKind(kind: Effect['kind']): FieldBag {
  switch (kind) {
    case 'PERMANENT':
      return 'attributes';
    case 'CURRENT':
      return 'state';
    case 'CONTEXT':
      return 'context';
    case 'RELATION':
      return 'relationships';
    case 'DEFERRED':
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
  }
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export type RejectedEffect = { effect: Effect; reason: string };

export type ApplyEffectsResult = {
  state: CareerState;
  applied: Effect[];
  rejected: RejectedEffect[];
};

/**
 * Effect 목록을 순서대로 적용한다. RELATION·CONTEXT는 attributes를 바꿀 수 없고,
 * PERMANENT만 attributes를 바꾼다. ONCE_PER_SOURCE는 `appliedSourceIds`에 있으면 reject한다.
 * expiresAt이 있는 효과는 `activeEffects`에 기록해 만료 시 delta를 되돌릴 수 있게 한다.
 */
export function applyEffects(state: CareerState, effects: Effect[], now: { step: number }): ApplyEffectsResult {
  const attributes: Record<AttributeKey, number> = { ...state.attributes };
  const current: { form: number; fitness: number; morale: number } = { ...state.state };
  const context: { tacticalFit: number; squadStatus: number; positionProficiency: number } = { ...state.context };
  const relationships: {
    managerTrust: number;
    captain: number;
    rival: number;
    fans: number;
    agent: number;
  } = { ...state.relationships };
  const appliedSourceIds = [...state.appliedSourceIds];
  const activeEffects = [...state.activeEffects];
  const deferredEffects = [...state.deferredEffects];

  const applied: Effect[] = [];
  const rejected: RejectedEffect[] = [];

  for (const effect of effects) {
    if (effect.stackingRule === 'ONCE_PER_SOURCE' && appliedSourceIds.includes(effect.sourceId)) {
      rejected.push({ effect, reason: 'ONCE_PER_SOURCE_DUPLICATE' });
      continue;
    }

    if (effect.kind === 'DEFERRED') {
      deferredEffects.push(effect);
      applied.push(effect);
      if (effect.stackingRule === 'ONCE_PER_SOURCE') {
        appliedSourceIds.push(effect.sourceId);
      }
      continue;
    }

    const bag = bagForKind(effect.kind);
    if (bag === null || !isValidTarget(bag, effect.target)) {
      rejected.push({ effect, reason: `INVALID_TARGET_FOR_KIND:${effect.kind}:${effect.target}` });
      continue;
    }

    const bagObj =
      bag === 'attributes'
        ? (attributes as Record<string, number>)
        : bag === 'state'
          ? (current as Record<string, number>)
          : bag === 'context'
            ? (context as Record<string, number>)
            : (relationships as Record<string, number>);

    const key = effect.target;
    const currentValue = bagObj[key] as number;
    const nextValue = effect.stackingRule === 'REPLACE' ? effect.delta : currentValue + effect.delta;
    bagObj[key] = clampValue(nextValue, effect.clamp.min, effect.clamp.max);

    applied.push(effect);
    if (effect.stackingRule === 'ONCE_PER_SOURCE') {
      appliedSourceIds.push(effect.sourceId);
    }

    if (effect.expiresAt !== null) {
      const storedEffect: Effect =
        effect.expiresAt.kind === 'STEPS_AFTER'
          ? { ...effect, expiresAt: { kind: 'AT_STEP', step: now.step + effect.expiresAt.steps } }
          : effect;
      activeEffects.push(storedEffect);
    }
  }

  return {
    state: {
      ...state,
      attributes,
      state: current,
      context,
      relationships,
      appliedSourceIds: appliedSourceIds.sort(compareCodePoints),
      activeEffects,
      deferredEffects,
    },
    applied,
    rejected,
  };
}

/** `AT_STEP`에 도달한 활성 효과를 되돌리고(clamp 적용) `activeEffects`에서 제거한다. */
export function expireEffects(state: CareerState, step: number): CareerState {
  const attributes: Record<AttributeKey, number> = { ...state.attributes };
  const current: { form: number; fitness: number; morale: number } = { ...state.state };
  const context: { tacticalFit: number; squadStatus: number; positionProficiency: number } = { ...state.context };
  const relationships: {
    managerTrust: number;
    captain: number;
    rival: number;
    fans: number;
    agent: number;
  } = { ...state.relationships };

  const remaining: Effect[] = [];

  for (const effect of state.activeEffects) {
    const expiresAt = effect.expiresAt;
    const shouldExpire = expiresAt !== null && expiresAt.kind === 'AT_STEP' && step >= expiresAt.step;
    if (!shouldExpire) {
      remaining.push(effect);
      continue;
    }

    const bag = bagForKind(effect.kind);
    if (bag === null) continue;

    const bagObj =
      bag === 'attributes'
        ? (attributes as Record<string, number>)
        : bag === 'state'
          ? (current as Record<string, number>)
          : bag === 'context'
            ? (context as Record<string, number>)
            : (relationships as Record<string, number>);

    const key = effect.target;
    const reverted = clampValue((bagObj[key] as number) - effect.delta, effect.clamp.min, effect.clamp.max);
    bagObj[key] = reverted;
  }

  return {
    ...state,
    attributes,
    state: current,
    context,
    relationships,
    activeEffects: remaining,
  };
}
