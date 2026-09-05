export const DOMAIN_VERSION = '0.1.0';

export {
  ArchiveError, createCareerArchiveCore, verifyCareerArchiveCore, planCareerArchiveWrite,
  type ArchiveArtifacts, type ArchiveContext, type CareerArchiveCore,
} from './legacy/archive.js';

export { clamp } from './clamp.js';
export { canonicalize, compareCodePoints, utf8Encode, type JsonValue } from './canonical.js';
export { sha256Hex, hashState } from './hash.js';
export { projectOfferSelection, seasonSquadSeed, type OfferProjection } from './offer-projection.js';
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
  type CareerTagGrant,
  type ChapterOutcomeKind,
  type ChapterRecord,
  type ChapterTrigger,
  type CheckpointType,
  type ClubStint,
  type ClubStintEndReason,
  type CompetitionRecord,
  type Competitor,
  type Contract,
  type ContractKind,
  type DecisionSlot,
  type DomainSnapshot,
  type Effect,
  type EffectExpiresAt,
  type EffectKind,
  type EffectStackingRule,
  type FootballSeason,
  type GrowthCause,
  type InjuryBodyPart,
  type InjuryEpisode,
  type InjurySeverity,
  type MarketSummary,
  type MatchAppearance,
  type MatchRecord,
  type NationalDebutReservation,
  type NationalTeamCallUp,
  type NationalTeamCallUpRecord,
  type NationalTeamState,
  type NationalityRuleState,
  type NegotiationAsk,
  type NegotiationState,
  type Offer,
  type OfferKind,
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
  type RehabPlan,
  type RelationTarget,
  type RelationshipLogEntry,
  type RoleProposal,
  type ScheduleEntry,
  type SeasonManager,
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
export {
  applyNationalTeamCallUp,
  buildNationalTeamCallUpRecord,
  chooseNationalOpponent,
  nationalTeamEffects,
  qualifyNationalTeam,
  reserveNationalDebut,
  type NationalTeamQualification,
  type NationalTeamQualificationReason,
} from './national-team.js';
export type {
  Archetype,
  Background,
  ContractRules,
  Cup,
  ConditionRules,
  GrowthAgeBand,
  GrowthAttributeGroup,
  GrowthRules,
  InjuryRules,
  League,
  LeagueCalendar,
  LeagueCalendarSlot,
  LeagueCalendarStep,
  ManagerRules,
  MarketValueRules,
  NationalTeamRules,
  OfferBranch,
  OfferRules,
  RelationshipRules,
  ReputationRules,
  Ruleset,
  SelectionRules,
  TacticalStyle,
  Team,
  TransferRules,
} from './ruleset.js';
export {
  applyEffects,
  expireAtSeasonEnd,
  expireEffects,
  resolveDeferredEffects,
  resolveDeferredKind,
  type ApplyEffectsResult,
  type RejectedEffect,
  type ResolvedDeferredKind,
} from './effects.js';
export {
  CAREER_TAGS,
  CAREER_TAG_EVALUATORS,
  CAREER_TAG_IDS,
  evaluateCareerTags,
  grantCareerTag,
  type CareerTagDefinition,
  type CareerTagEvaluateAt,
  type CareerTagEvaluator,
  type CareerTagId,
  type CareerTagRarity,
  type GrantCareerTagSource,
} from './career-tags.js';
export {
  buildMarketValueInput,
  computeContractSeasonsRemaining,
  computeMarketValueIndex,
  type MarketValueComponent,
  type MarketValueInput,
  type MarketValueResult,
} from './market-value.js';
export { canNegotiate, expireOffers, isOfferExpired, type ExpireOffersResult } from './negotiation.js';
export {
  buildRenewalOffer,
  generateMarket,
  judgeMarketReason,
  openMarketAfterSettlement,
  type GenerateMarketArgs,
  type GeneratedMarket,
  type OpenMarketResult,
} from './market.js';
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
  adjustedSeverityWeights,
  applyRehabPlan,
  injuryAvailabilityFromHealth,
  onInjuryRecovered,
  onMatchInjury,
  onMatchRecurrence,
  onRecurrenceCheckFailed,
  rehabDurationRange,
  syncInjuryRemaining,
} from './injury.js';
export { findInjuryReturnMatchId } from './injury-return.js';
export { buildDefaultManager, buildReplacementManager, codePointSum, managerTenureSeasons } from './manager.js';
export { onSettlementRelations } from './relationships.js';
export { appendRelationshipLog } from './effects.js';
export {
  applySettlementReputation,
  computePopularityDelta,
  computeSettlementPopularityDelta,
  seasonWonTitle,
} from './reputation.js';
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
export { createLegacyResult, deriveLegacyEvidence, deriveRetirementTags, LEGACY_POLICY, LEGACY_POLICY_110, legacyPolicyForVersion, type LegacyVersion, type LegacyResult, type LegacyReferencePopulation, type LegacyFactor, type LegacySource } from './legacy/result.js';
export { legacyEndingPresentation, legacyBandPresentation } from './legacy/presentation.js';
export { selectLegacyDisplayEnding, type LegacyEndingId } from './legacy/endings.js';
export { initializeNationalityModule, assessNationalityAtSeasonBoundary, resolveNationalityChoice, grantTournamentException, isU23Eligible, type NationalityState } from './legacy/nationality.js';
export { careerEventChoices, nationalityForCareer, type CareerEventChoice } from './legacy/career-event.js';
export { assessCareerRetirement, retirementContinuationOptions, retirementDecisionRequired, RETIREMENT_POLICY } from './legacy/career-retirement.js';
