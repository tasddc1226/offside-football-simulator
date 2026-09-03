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
  type ChapterTrigger,
  type CheckpointType,
  type CompetitionRecord,
  type Competitor,
  type Contract,
  type DecisionSlot,
  type DomainSnapshot,
  type Effect,
  type EffectKind,
  type FootballSeason,
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
export {
  matchesTrigger,
  resolveChapter,
  selectChapter,
  type ChapterCandidateInput,
  type ChapterOpenResult,
  type ResolveChapterFailureReason,
  type ResolveChapterInput,
  type ResolveChapterOutcome,
  type ResolveChapterResult,
  type SelectChapterInput,
} from './chapter.js';
export { buildSchedule, findLeague, isRivalOpponent, resolveOpponent } from './schedule.js';
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
