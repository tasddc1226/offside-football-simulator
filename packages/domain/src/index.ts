export const DOMAIN_VERSION = '0.1.0';

export { clamp } from './clamp.js';
export { canonicalize, compareCodePoints, utf8Encode, type JsonValue } from './canonical.js';
export { sha256Hex, hashState } from './hash.js';
export { seedRng, nextUint32, rollInt, roll100, type RngState } from './rng.js';
export { rollRange } from './roll-range.js';
export {
  ATTRIBUTE_KEYS,
  positionGroupOf,
  statGroupOf,
  type AttributeKey,
  type Availability,
  type CareerPhase,
  type CareerStage,
  type CareerState,
  type CareerStatus,
  type ChapterRecord,
  type CheckpointType,
  type CompetitionRecord,
  type Competitor,
  type Contract,
  type DecisionSlot,
  type DomainSnapshot,
  type Effect,
  type EffectKind,
  type FootballSeason,
  type GrowthCause,
  type MatchAppearance,
  type MatchRecord,
  type Offer,
  type OutReason,
  type Pending,
  type PlayerDraft,
  type PlayerGender,
  type PlayerProfile,
  type Position,
  type PositionGroup,
  type PositionStats,
  type PositionStatsTotals,
  type PreferredFoot,
  type RoleProposal,
  type ScheduleEntry,
  type SeasonPhase,
  type SeasonPlayerStats,
  type SeasonResult,
  type SeasonStep,
  type SeasonSummary,
  type SelectionAppearance,
  type SelectionCandidate,
  type SelectionRanking,
  type SelectionReasonComponent,
  type SimulationMode,
  type SquadRole,
  type StatGroup,
  type StepMatchResult,
  type StepSummary,
  type TimelineEntry,
  type TrainingFocus,
} from './types.js';
export type {
  Archetype,
  Background,
  ContractRules,
  Cup,
  ConditionRules,
  GrowthAgeBand,
  GrowthAttributeGroup,
  GrowthRules,
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
export {
  applyEffects,
  expireEffects,
  resolveDeferredEffects,
  resolveDeferredKind,
  type ApplyEffectsResult,
  type RejectedEffect,
  type ResolvedDeferredKind,
} from './effects.js';
export { attributeGroupOf, computeGrowth, type GrowthAttributeDelta, type GrowthInput, type GrowthResult } from './growth.js';
export { applyCondition, type ConditionState } from './condition.js';
export {
  buildSeasonResult,
  computePromiseFulfilment,
  hashSeasonResult,
  type BuildSeasonResultInput,
} from './settlement.js';
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
export { buildSchedule, findLeague, resolveOpponent } from './schedule.js';
export { applyCompetitorFormDrift, playMatch, type PlayMatchInput, type PlayMatchResult } from './match.js';
export {
  applyMatchToCompetitions,
  applyMatchToPlayerStats,
  applyPlayedMatch,
  computeLeaguePosition,
  initialSeasonPlayerStats,
  markCupEliminated,
  stepMatchResultsFor,
  type SeasonMatchBooks,
} from './season-stats.js';
