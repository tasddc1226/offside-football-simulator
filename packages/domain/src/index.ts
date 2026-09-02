export const DOMAIN_VERSION = '0.1.0';

/**
 * 값을 [min, max] 범위로 자른다. RULE-* 계산의 능력치·확률 clamp에 쓰인다.
 */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('min은 max보다 클 수 없다.');
  }
  return Math.min(Math.max(value, min), max);
}

export { canonicalize, compareCodePoints, utf8Encode, type JsonValue } from './canonical.js';
export { sha256Hex, hashState } from './hash.js';
export { seedRng, nextUint32, rollInt, roll100, type RngState } from './rng.js';
export {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type CareerPhase,
  type CareerStage,
  type CareerState,
  type CareerStatus,
  type CheckpointType,
  type DomainSnapshot,
  type Effect,
  type EffectKind,
  type SeasonPhase,
  type SimulationMode,
  type SquadRole,
} from './types.js';
export { applyEffects, expireEffects, type ApplyEffectsResult, type RejectedEffect } from './effects.js';
export {
  simulate,
  verifySnapshot,
  type Command,
  type SimulationInput,
  type SimulationResult,
} from './simulate.js';
