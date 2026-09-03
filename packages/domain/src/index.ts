export const DOMAIN_VERSION = '0.1.0';

export { clamp } from './clamp.js';
export { canonicalize, compareCodePoints, utf8Encode, type JsonValue } from './canonical.js';
export { sha256Hex, hashState } from './hash.js';
export { seedRng, nextUint32, rollInt, roll100, type RngState } from './rng.js';
export { rollRange } from './roll-range.js';
export {
  ATTRIBUTE_KEYS,
  positionGroupOf,
  type AttributeKey,
  type CareerPhase,
  type CareerStage,
  type CareerState,
  type CareerStatus,
  type CheckpointType,
  type Contract,
  type DomainSnapshot,
  type Effect,
  type EffectKind,
  type Offer,
  type Pending,
  type PlayerDraft,
  type PlayerGender,
  type PlayerProfile,
  type Position,
  type PositionGroup,
  type PreferredFoot,
  type SeasonPhase,
  type SimulationMode,
  type SquadRole,
  type TimelineEntry,
} from './types.js';
export type { Archetype, Background, ContractRules, OfferBranch, OfferRules, Ruleset, Team } from './ruleset.js';
export { applyEffects, expireEffects, type ApplyEffectsResult, type RejectedEffect } from './effects.js';
export { computeBaseOvr, generatePlayerProfile, type ConfirmedPlayerDraft, type GeneratedPlayer } from './player.js';
export {
  simulate,
  verifySnapshot,
  type Command,
  type SimulationInput,
  type SimulationResult,
} from './simulate.js';
