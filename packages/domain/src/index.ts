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
  type CompetitionRecord,
  type Competitor,
  type Contract,
  type DecisionSlot,
  type DomainSnapshot,
  type Effect,
  type EffectKind,
  type FootballSeason,
  type MatchRecord,
  type Offer,
  type Pending,
  type PlayerDraft,
  type PlayerGender,
  type PlayerProfile,
  type Position,
  type PositionGroup,
  type PreferredFoot,
  type RoleProposal,
  type SeasonPhase,
  type SeasonStep,
  type SeasonSummary,
  type SelectionAppearance,
  type SelectionCandidate,
  type SelectionRanking,
  type SelectionReasonComponent,
  type SimulationMode,
  type SquadRole,
  type StepSummary,
  type TimelineEntry,
} from './types.js';
export type {
  Archetype,
  Background,
  ContractRules,
  Cup,
  League,
  LeagueCalendar,
  LeagueCalendarSlot,
  LeagueCalendarStep,
  OfferBranch,
  OfferRules,
  Ruleset,
  SelectionRules,
  TacticalStyle,
  Team,
} from './ruleset.js';
export { applyEffects, expireEffects, type ApplyEffectsResult, type RejectedEffect } from './effects.js';
export { computeBaseOvr, generatePlayerProfile, type ConfirmedPlayerDraft, type GeneratedPlayer } from './player.js';
export {
  buildInitialCompetitions,
  buildSeasonSteps,
  findSeasonStep,
  isAutoPassablePending,
  markStepPassed,
  selectOpenSlot,
  type EligibleEvent,
  type SlotOpenResult,
} from './season.js';
export {
  computeExpectedPerformance,
  computeRoleProposal,
  computeSelectionScore,
  computeSquadStatus,
  computeTacticalFit,
  deriveTacticalRoom,
  familiarityOf,
  findTacticalStyle,
  rankPositionForPlayer,
  rankSelection,
  squadRoleFromSelection,
  type RankPositionForPlayerInput,
  type RoleProposalContext,
  type TacticalRoomView,
} from './selection.js';
export { generateCompetitors, type GeneratedCompetitors } from './competitors.js';
export {
  simulate,
  verifySnapshot,
  type Command,
  type SimulationInput,
  type SimulationResult,
} from './simulate.js';
