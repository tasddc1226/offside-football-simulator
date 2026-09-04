import { compareCodePoints, type JsonValue } from './canonical.js';
import { clamp } from './clamp.js';
import { resolveChapter, type ChapterCandidateInput } from './chapter.js';
import { applyCondition, type ConditionState } from './condition.js';
import { generateCompetitors } from './competitors.js';
import {
  applyEffects,
  expireAtSeasonEnd,
  expireEffects,
  resolveDeferredEffects,
} from './effects.js';
import { evaluateCareerTags, grantCareerTag } from './career-tags.js';
import { computeGrowth } from './growth.js';
import { hashState } from './hash.js';
import { applyRehabPlan, onMatchInjury } from './injury.js';
import { generateMarket, openMarketAfterSettlement } from './market.js';
import { computeContractSeasonsRemaining } from './market-value.js';
import { buildDefaultManager } from './manager.js';
import { canNegotiate, expireOffers } from './negotiation.js';
import {
  findMatchingOfferBranch,
  findOvrBand,
  generateOffers,
  lookupBandAmount,
} from './offers.js';
import { playMatch } from './match.js';
import { generatePlayerProfile, type ConfirmedPlayerDraft } from './player.js';
import { onSettlementRelations } from './relationships.js';
import { rollInt, seedRng, type RngState } from './rng.js';
import { rollRange } from './roll-range.js';
import type { League, LeagueCalendar, Ruleset, Team } from './ruleset.js';
import { buildSchedule, findLeague } from './schedule.js';
import {
  buildInitialCompetitions,
  buildSeasonSteps,
  findSeasonStep,
  isAutoPassablePending,
  markStepPassed,
  walkToNextDecision,
  type ChapterWalkContext,
  type EligibleEvent,
  type PlayStepMatches,
  type SeasonWalkResult,
} from './season.js';
import {
  applyPlayedMatch,
  initialSeasonPlayerStats,
  stepMatchResultsFor,
  type SeasonMatchBooks,
} from './season-stats.js';
import { buildSeasonResult, hashSeasonResult } from './settlement.js';
import {
  computeSquadStatus,
  computeTacticalFit,
  familiarityOf,
  findTacticalStyle,
  rankPositionForPlayer,
  squadRoleFromSelection,
  type RoleProposalContext,
} from './selection.js';
import {
  ATTRIBUTE_KEYS,
  statGroupOf,
  type Availability,
  type AttributeKey,
  type CareerStage,
  type CareerState,
  type ChapterOutcomeKind,
  type ClubStint,
  type ClubStintEndReason,
  type Competitor,
  type Contract,
  type DomainSnapshot,
  type Effect,
  type FootballSeason,
  type MatchRecord,
  type NationalTeamCallUp,
  type NegotiationAsk,
  type Offer,
  type Pending,
  type PlayerDraft,
  type PlayerGender,
  type PlayerProfile,
  type Position,
  type PreferredFoot,
  type RehabPlan,
  type SelectionRanking,
  type SeasonResult,
  type SeasonSummary,
  type SimulationMode,
  type SquadRole,
  type TimelineEntry,
  type TrainingFocus,
} from './types.js';

export type Command =
  | {
      type: 'CREATE_CAREER';
      payload: {
        careerId: string;
        seed: string;
        simulationMode: SimulationMode;
        rulesetVersion: string;
        contentPackVersion: string;
      };
    }
  | { type: 'UPDATE_PLAYER_DRAFT'; payload: { draft: Partial<PlayerDraft> } }
  | { type: 'CONFIRM_PLAYER'; payload: Record<string, never> }
  | {
      type: 'START_SEASON';
      // D-25는 payload를 { simulationMode }로만 적었지만, FootballSeason.serviceSeasonId(브리프
      // 데이터 계약)는 domain CareerState 어디에도 없다(engine-client Career 래퍼 필드라 T-2-001
      // 범위 밖). CREATE_CAREER처럼 payload로 받는다(PR 본문에 기록).
      // T-2-005 D-39: trainingFocus는 없으면 'ROLE'(기존 골든 호환).
      payload: {
        simulationMode: SimulationMode;
        serviceSeasonId: string;
        trainingFocus?: TrainingFocus;
      };
    }
  | {
      type: 'ADVANCE';
      payload: {
        eligibleEvents: Array<{ eventId: string; version: number; weight: number }>;
        // T-2-004 D-38: 웹이 팩 chapters[]에서 요약해 보낸다. 비면(undefined 포함) 챕터는 열리지
        // 않는다(기존 골든 호환 — chapterCandidates를 보내지 않던 골든은 stateHash가 그대로다).
        chapterCandidates?: ChapterCandidateInput[];
      };
    }
  | { type: 'SETTLE_SEASON'; payload: Record<string, never> }
  // T-2-002 D-34 CMD-SIM-004: step 1 ROLE_PROPOSAL pending을 닫는다.
  | { type: 'RESOLVE_ROLE'; payload: { decision: 'ACCEPT' | 'DECLINE' } }
  | {
      type: 'RESOLVE_EVENT';
      payload: {
        eventId: string;
        definitionVersion: number;
        choiceId: string;
        outcomes: Array<{
          id: string;
          kind?: ChapterOutcomeKind;
          weight: number;
          effects: Effect[];
          addTags?: string[];
          removeTags?: string[];
        }>;
        // T-4-001 D-52: pending.kind가 INJURY면 필수, NATIONAL_TEAM이면 아래 callUp이 필수. EVENT
        // pending에 둘 중 하나라도 오면 PAYLOAD_KIND_MISMATCH.
        rehabPlan?: RehabPlan;
        callUp?: NationalTeamCallUp;
      };
    }
  // T-2-004 D-38 CMD-SIM-005: CHAPTER pending의 판단 하나를 닫는다. T-2-014 D-42: outcomes[].kind는
  // 필수(웹 T-2-008이 채운다).
  | {
      type: 'RESOLVE_CHAPTER';
      payload: {
        chapterId: string;
        definitionVersion: number;
        decisionId: string;
        optionId: string;
        outcomes: Array<{
          id: string;
          kind: ChapterOutcomeKind;
          weight: number;
          effects: Effect[];
          ratingDeltaTenths: number;
          addTags?: string[];
          removeTags?: string[];
        }>;
      };
    }
  | { type: 'ACCEPT_OFFER'; payload: { offerId: string } }
  // T-3-001 D-52 CMD-CON-001~003 예약: 처리기는 T-3-003 전까지 "T-3-003에서 구현" 오류를 돌려준다
  // (throw 금지). payload 형태는 phase-3-4-plan D-44/D-46이 정한 것을 그대로 옮긴다.
  | { type: 'NEGOTIATE'; payload: { offerId: string; ask: NegotiationAsk } }
  | { type: 'REJECT_OFFER'; payload: { offerId: string | null } } // null = 전부 거절 → 잔류
  | { type: 'LOAN_RETURN'; payload: { decision: 'RETURN' | 'PERMANENT' } };

export type SimulationInput = {
  snapshot: DomainSnapshot | null;
  command: Command & { commandId: string; expectedRevision: number };
  ruleset: Ruleset;
  rulesetVersion: string;
  contentPackVersion: string;
};

export type SimulationResult =
  | {
      ok: true;
      snapshot: DomainSnapshot;
      roll?: number;
      outcomeId?: string;
      appliedEffects: Effect[];
      nextAction: 'DECISION' | 'ADVANCE' | 'SETTLEMENT';
      /** T-2-005 D-39: SETTLE_SEASON 응답에만 실린다(snapshot.state.seasonHistory에도 같은 값이
       * 있으니 웹은 둘 중 하나만 써도 된다). */
      seasonResult?: SeasonResult;
    }
  | {
      ok: false;
      error: {
        code:
          | 'VALIDATION_FAILED'
          | 'CAREER_REVISION_CONFLICT'
          | 'COMMAND_ALREADY_RESOLVED'
          | 'VERSION_MISMATCH';
        message: string;
        details?: JsonValue;
      };
    };

function fail(
  code:
    | 'VALIDATION_FAILED'
    | 'CAREER_REVISION_CONFLICT'
    | 'COMMAND_ALREADY_RESOLVED'
    | 'VERSION_MISMATCH',
  message: string,
  details?: JsonValue,
): SimulationResult {
  return details === undefined
    ? { ok: false, error: { code, message } }
    : { ok: false, error: { code, message, details } };
}

function sortUniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags)).sort(compareCodePoints);
}

function buildSnapshot(
  state: CareerState,
  revision: number,
  checkpoint: DomainSnapshot['checkpoint'],
): DomainSnapshot {
  return {
    revision,
    checkpoint,
    state,
    stateHash: hashState(state),
    rulesetVersion: state.rulesetVersion,
    contentPackVersion: state.contentPackVersion,
  };
}

function zeroAttributes(): Record<AttributeKey, number> {
  const attributes = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = 0;
  }
  return attributes;
}

/** T-2-005 D-39: `growthCarryCenti`의 초기값(정수 centi 이월, CREATE_CAREER 시점엔 전부 0). */
function zeroGrowthCarry(): Record<AttributeKey, number> {
  return zeroAttributes();
}

function emptyDraft(): PlayerDraft {
  return {
    name: null,
    gender: null,
    nationalityCode: null,
    preferredFoot: null,
    position: null,
    archetypeId: null,
    backgroundId: null,
  };
}

function createCareer(input: SimulationInput): SimulationResult {
  const command = input.command;
  if (command.type !== 'CREATE_CAREER') {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER 처리기에 다른 명령이 전달되었다.');
  }
  if (input.snapshot !== null) {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER는 기존 snapshot이 없을 때만 유효하다.');
  }
  if (command.expectedRevision !== 0) {
    return fail('CAREER_REVISION_CONFLICT', '새 Career의 expectedRevision은 0이어야 한다.', {
      serverRevision: 0,
      expectedRevision: command.expectedRevision,
    });
  }
  if (
    command.payload.rulesetVersion !== input.rulesetVersion ||
    command.payload.contentPackVersion !== input.contentPackVersion
  ) {
    return fail('VERSION_MISMATCH', '명령의 버전이 SimulationInput의 버전과 다르다.');
  }

  const state: CareerState = {
    schemaVersion: 1,
    careerId: command.payload.careerId,
    status: 'DRAFT',
    stage: 'YOUTH',
    age: 17,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: command.payload.simulationMode,
    attributes: zeroAttributes(),
    growthCarryCenti: zeroGrowthCarry(),
    state: { form: 0, fitness: 0, morale: 0 },
    context: { tacticalFit: 0, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 0, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: seedRng(command.payload.seed),
    rulesetVersion: command.payload.rulesetVersion,
    contentPackVersion: command.payload.contentPackVersion,
    player: { draft: emptyDraft(), profile: null },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
    nextManager: null,
    captaincy: 'NONE',
    captaincySeasons: 0,
    controversyFailures: 0,
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: {
      popularityCenti: input.ruleset.reputationRules.initialPopularityCenti,
      mediaCenti: input.ruleset.reputationRules.initialMediaCenti,
    },
  };

  return {
    ok: true,
    snapshot: buildSnapshot(state, 1, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'DECISION',
  };
}

const POSITIONS: readonly Position[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
const PREFERRED_FEET: readonly PreferredFoot[] = ['LEFT', 'RIGHT', 'BOTH'];
const GENDERS: readonly PlayerGender[] = ['FEMALE', 'MALE', 'UNSPECIFIED'];

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function has<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function updatePlayerDraft(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'UPDATE_PLAYER_DRAFT') {
    return fail('VALIDATION_FAILED', 'UPDATE_PLAYER_DRAFT 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'DRAFT') {
    return fail('VALIDATION_FAILED', 'DRAFT 상태에서만 UPDATE_PLAYER_DRAFT를 받을 수 있다.', {
      reason: 'NOT_DRAFT',
    });
  }

  const patch = command.payload.draft;
  const merged: PlayerDraft = { ...state.player.draft };
  const ruleset = input.ruleset;

  if (has(patch, 'name')) {
    const raw = patch.name as string | null;
    if (raw === null) {
      merged.name = null;
    } else {
      const trimmed = raw.trim();
      const { nameMin, nameMax } = ruleset.draftRules;
      if (trimmed.length < nameMin || trimmed.length > nameMax) {
        return fail('VALIDATION_FAILED', `이름은 ${nameMin}~${nameMax}자여야 한다.`, {
          field: 'name',
          reason: 'LENGTH',
        });
      }
      if (hasControlChars(raw)) {
        return fail('VALIDATION_FAILED', '이름에 제어문자·줄바꿈을 쓸 수 없다.', {
          field: 'name',
          reason: 'CONTROL_CHARS',
        });
      }
      merged.name = trimmed;
    }
  }

  if (has(patch, 'gender')) {
    const raw = patch.gender as PlayerGender | null;
    if (raw !== null && !GENDERS.includes(raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 성별: ${raw}`, {
        field: 'gender',
        reason: 'UNKNOWN',
      });
    }
    merged.gender = raw;
  }

  if (has(patch, 'nationalityCode')) {
    const raw = patch.nationalityCode as string | null;
    if (raw !== null && !ruleset.nationalities.some((nationality) => nationality.code === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 국적 코드: ${raw}`, {
        field: 'nationalityCode',
        reason: 'UNKNOWN',
      });
    }
    merged.nationalityCode = raw;
  }

  if (has(patch, 'preferredFoot')) {
    const raw = patch.preferredFoot as PreferredFoot | null;
    if (raw !== null && !PREFERRED_FEET.includes(raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 주발: ${raw}`, {
        field: 'preferredFoot',
        reason: 'UNKNOWN',
      });
    }
    merged.preferredFoot = raw;
  }

  if (has(patch, 'position')) {
    const raw = patch.position as Position | null;
    if (raw !== null && !POSITIONS.includes(raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 포지션: ${raw}`, {
        field: 'position',
        reason: 'UNKNOWN',
      });
    }
    merged.position = raw;
  }

  if (has(patch, 'archetypeId')) {
    const raw = patch.archetypeId as string | null;
    if (raw !== null && !ruleset.archetypes.some((archetype) => archetype.id === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 아키타입: ${raw}`, {
        field: 'archetypeId',
        reason: 'UNKNOWN',
      });
    }
    merged.archetypeId = raw;
  }

  if (has(patch, 'backgroundId')) {
    const raw = patch.backgroundId as string | null;
    if (raw !== null && !ruleset.backgrounds.some((background) => background.id === raw)) {
      return fail('VALIDATION_FAILED', `알 수 없는 배경: ${raw}`, {
        field: 'backgroundId',
        reason: 'UNKNOWN',
      });
    }
    merged.backgroundId = raw;
  }

  if (merged.position !== null && merged.archetypeId !== null) {
    const archetype = ruleset.archetypes.find((candidate) => candidate.id === merged.archetypeId);
    if (archetype !== undefined && archetype.position !== merged.position) {
      return fail('VALIDATION_FAILED', '아키타입과 포지션이 일치하지 않는다.', {
        field: 'archetypeId',
        reason: 'ARCHETYPE_POSITION_MISMATCH',
      });
    }
  }

  const nextState: CareerState = { ...state, player: { ...state.player, draft: merged } };
  return {
    ok: true,
    snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'DECISION',
  };
}

const DRAFT_FIELDS: Array<keyof PlayerDraft> = [
  'name',
  'gender',
  'nationalityCode',
  'preferredFoot',
  'position',
  'archetypeId',
  'backgroundId',
];

function confirmPlayer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'CONFIRM_PLAYER') {
    return fail('VALIDATION_FAILED', 'CONFIRM_PLAYER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'DRAFT') {
    return fail('VALIDATION_FAILED', 'DRAFT 상태에서만 CONFIRM_PLAYER를 받을 수 있다.', {
      reason: 'NOT_DRAFT',
    });
  }

  const draft = state.player.draft;
  const missing = DRAFT_FIELDS.filter((field) => draft[field] === null);
  if (missing.length > 0) {
    return fail('VALIDATION_FAILED', '선수 초안이 완성되지 않았다.', { missing });
  }

  const confirmedDraft: ConfirmedPlayerDraft = {
    name: draft.name as string,
    gender: draft.gender as PlayerGender,
    nationalityCode: draft.nationalityCode as string,
    preferredFoot: draft.preferredFoot as PreferredFoot,
    position: draft.position as Position,
    archetypeId: draft.archetypeId as string,
    backgroundId: draft.backgroundId as string,
  };

  const generated = generatePlayerProfile(confirmedDraft, input.ruleset, state.rngState);
  const nextRevision = snapshot.revision + 1;
  const nextStep = 12;

  const nextState: CareerState = {
    ...state,
    status: 'ACTIVE',
    currentStep: nextStep,
    seasonPhase: 'SETTLEMENT',
    attributes: generated.attributes,
    state: generated.state,
    context: generated.context,
    relationships: generated.relationships,
    rngState: generated.rngState,
    player: { draft: state.player.draft, profile: generated.profile },
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'CAREER_CONFIRMED',
        refId: null,
        age: state.age,
        step: nextStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CAREER_CREATED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * Phase 1 `advance()`가 매 step 전환마다 `expireEffects`를 부르는 것과 같은 규칙을, 시즌 walk가
 * 한 번에 여러 step을 건너뛸 때도 지키기 위한 헬퍼. `walked`가 이번 walk에서 지나간 step(결정 없이
 * 닫은 step들)과 마지막으로 멈춘 step을 오름차순으로 갖고 있으므로, 그 순서대로 접어 적용한다 —
 * 그래야 AT_STEP 효과가 시즌 중에도(여러 step을 건너뛰어도) 정확히 만료된다. T-2-005 D-39: 각
 * step마다 "DEFERRED 해석(`resolveDeferredEffects`) → AT_STEP 만료(`expireEffects`)" 순서로 접는다
 * (DEFERRED가 새로 activeEffects를 등록할 수 있으니 만료보다 먼저 온다).
 */
function advanceEffectsThroughWalk(
  state: CareerState,
  walked: SeasonWalkResult,
  relationshipRules: Ruleset['relationshipRules'],
): CareerState {
  const crossedSteps = [...walked.passedStepIndexes, walked.currentStepIndex];
  return crossedSteps.reduce(
    (acc, step) => expireEffects(resolveDeferredEffects(acc, step, relationshipRules), step),
    state,
  );
}

/**
 * T-2-004 D-38: 챕터가 열린 순간 `MatchRecord.chapterId`를 세운다(판단이 남아 있어도). `season.ts`는
 * matches 배열을 갖고 있지 않아 이 patch를 여기서 한다 — `walked.pending`이 CHAPTER일 때만 그
 * `matchId`와 같은 레코드 하나를 바꾼다.
 */
function patchOpenedChapterMatch(matches: readonly MatchRecord[], pending: Pending): MatchRecord[] {
  if (pending === null || pending.kind !== 'CHAPTER') return [...matches];
  const matchId = pending.matchId;
  const chapterId = pending.chapterId;
  return matches.map((match) => (match.id === matchId ? { ...match, chapterId } : match));
}

function findTeam(ruleset: Ruleset, teamId: string): Ruleset['teams'][number] {
  const team = ruleset.teams.find((candidate) => candidate.id === teamId);
  if (team === undefined) {
    throw new RangeError(`findTeam: 룰셋에 teamId '${teamId}'가 없다.`);
  }
  return team;
}

/**
 * T-2-002 D-34: ROLE_PROPOSAL·컴퓨티터 순위가 참조하는 현재 시점의 맥락. `season.selection`·
 * `season.squad.competitors`·`season.styleId`가 이미 있어야 하므로 `startSeason`(자체 계산분을 직접
 * 넘긴다)과 `advanceInSeason`(저장된 season 값을 그대로 넘긴다) 양쪽에서 쓴다.
 */
function buildRoleContext(
  state: CareerState,
  ruleset: Ruleset,
  styleId: string,
  selection: SelectionRanking,
  competitors: readonly Competitor[],
): RoleProposalContext {
  const profile = state.player.profile;
  if (profile === null) throw new RangeError('buildRoleContext: player.profile이 null이다.');
  if (state.contract === null) throw new RangeError('buildRoleContext: contract가 null이다.');
  return {
    ruleset,
    styleId,
    playerName: profile.name,
    primaryPosition: profile.primaryPosition,
    archetypeId: profile.archetypeId,
    attributes: state.attributes,
    baseOvr: profile.baseOvr,
    rolePromise: state.contract.rolePromise,
    managerTrust: state.relationships.managerTrust,
    form: state.state.form,
    fitness: state.state.fitness,
    morale: state.state.morale,
    squadStatus: state.context.squadStatus,
    currentSelection: selection,
    competitors,
  };
}

type StepMatchWiring = {
  playStepMatches: PlayStepMatches;
  getMatches: () => FootballSeason['matches'];
  getCompetitions: () => FootballSeason['competitions'];
  getSchedule: () => FootballSeason['schedule'];
  getPlayerStats: () => FootballSeason['playerStats'];
  getCompetitors: () => Competitor[];
  getSelection: () => SelectionRanking;
  getSquadRole: () => SquadRole;
  getAvailability: () => Availability;
  getLastRatingTenths: () => number | null;
  getYellowSuspensionCount: () => number;
  getSquadStatus: () => number;
  getMatchRngState: () => RngState;
  /** T-2-005 D-39: 매 step 경기 뒤 `applyCondition`이 갱신한 선수 본인 폼·체력·사기. */
  getPlayerCondition: () => ConditionState;
  /** T-4-001 D-49: `onMatchInjury` 훅이 갱신한 부상 이력. */
  getHealth: () => CareerState['health'];
  /** T-4-001 D-49: `onMatchInjury` 훅이 남긴 타임라인 항목(지금은 항상 빈 배열 — 훅이 항등이라). */
  getInjuryTimeline: () => TimelineEntry[];
};

type StepMatchWiringInitial = SeasonMatchBooks & {
  competitors: readonly Competitor[];
  selection: SelectionRanking;
  squadRole: SquadRole;
  availability: Availability;
  lastRatingTenths: number | null;
  yellowSuspensionCount: number;
  squadStatus: number;
  matchRngState: RngState;
  /** T-4-001 D-49: `onMatchInjury` 훅 입력용, 이 시즌에 이미 만든 INJURY pending 수(증가는 T-4-002). */
  injuryCount: number;
};

/**
 * T-2-003 D-35: `walkToNextDecision`이 매 step마다 부르는 `playStepMatches`를 만든다. 이 시즌의
 * 예정 경기(스킵된 컵 라운드 제외)를 순서대로 재생하며 경기 전용 RNG 스트림(`matchRngState` — 결정
 * 슬롯이 쓰는 `state.rngState`와 분리, FAST·CHAPTER byte-identical 요구사항의 근거)·경기 기록·시즌
 * 통계·대회 기록·일정(컵 탈락 skip)·경쟁자 form·선수 selection/squadRole/availability/
 * lastRatingTenths/squadStatus/경고 카운트를 함께 갱신한다(closure로 누적 — walkToNextDecision
 * 자체는 이 값들의 모양을 모른다). walk가 끝난 뒤 `get*`로 최종 값을 꺼내 season/state에 반영한다.
 * T-2-005 D-39: 이 step의 경기를 다 돌린 직후(entries가 비어도) `applyCondition`을 한 번 불러 선수
 * 본인 폼·체력·사기(`playerCondition`)를 갱신한다 — 이후 step의 경기는 갱신된 값을 쓴다(같은 step
 * 안 여러 경기는 그 step이 끝나기 전까지 같은 값을 공유한다, roll 없음 규칙).
 */
function createStepMatchWiring(
  ruleset: Ruleset,
  team: Team,
  league: League,
  calendar: LeagueCalendar,
  styleId: string,
  profile: PlayerProfile,
  rolePromise: SquadRole,
  managerTrust: number,
  initialCondition: ConditionState,
  tacticalFit: number,
  positionProficiency: number,
  seasonIndex: number,
  // T-4-001 D-49: `onMatchInjury` 훅에 넘길 CareerState 스냅샷(`.health`만 실제로 쓴다 — 나머지
  // 필드는 훅이 지금은 항등이라 읽지 않는다). walk 도중 갱신되는 값은 이 참조가 아니라 아래 `health`
  // closure 변수로 추적한다.
  careerState: CareerState,
  initial: StepMatchWiringInitial,
): StepMatchWiring {
  let matches = initial.matches;
  let competitions = initial.competitions;
  let schedule = initial.schedule;
  let playerStats = initial.playerStats;
  let competitors: Competitor[] = [...initial.competitors];
  let selection = initial.selection;
  let squadRole = initial.squadRole;
  let availability = initial.availability;
  let lastRatingTenths = initial.lastRatingTenths;
  let yellowSuspensionCount = initial.yellowSuspensionCount;
  let squadStatus = initial.squadStatus;
  let matchRngState = initial.matchRngState;
  let playerCondition = initialCondition;
  let health = careerState.health;
  let injuryTimeline: TimelineEntry[] = [];

  const playStepMatches: PlayStepMatches = (stepIndex) => {
    const entries = schedule.filter(
      (entry) => entry.step === stepIndex && entry.skipped === undefined,
    );
    for (const entry of entries) {
      const matchIndex = matches.length;
      const result = playMatch({
        ruleset,
        rngState: matchRngState,
        seasonIndex,
        matchIndex,
        scheduleEntry: entry,
        team,
        league,
        styleId,
        playerName: profile.name,
        primaryPosition: profile.primaryPosition,
        baseOvr: profile.baseOvr,
        tacticalFit,
        managerTrust,
        form: playerCondition.form,
        fitness: playerCondition.fitness,
        morale: playerCondition.morale,
        positionProficiency,
        squadStatus,
        rolePromise,
        competitors,
        availability,
        seasonYellowCount: yellowSuspensionCount,
        lastRatingTenths,
      });
      matchRngState = result.rngState;
      const books = applyPlayedMatch(
        ruleset,
        team,
        league,
        calendar,
        { matches, competitions, playerStats, schedule },
        result.match,
      );
      matches = books.matches;
      competitions = books.competitions;
      playerStats = books.playerStats;
      schedule = books.schedule;
      competitors = result.nextCompetitors;
      selection = result.selection;
      squadRole = squadRoleFromSelection(result.selection);
      availability = result.nextAvailability;
      lastRatingTenths = result.nextLastRatingTenths;
      yellowSuspensionCount = result.nextSeasonYellowCount;
      squadStatus = result.nextSquadStatus;

      // T-4-001 D-49: 부상 이탈 경기마다 onMatchInjury 훅을 부른다(지금은 항등 골격 — 실제 심각도·
      // 부위 roll·availability 설정은 T-4-002가 채운다). matchRng를 넘겨 그 작업이 rng 소비 순서를
      // 이 지점에 이어 붙일 수 있게 한다.
      if (result.match.injuredOff) {
        const hookResult = onMatchInjury({
          state: { ...careerState, health },
          seasonIndex,
          step: stepIndex,
          match: result.match,
          availability,
          injuryCount: initial.injuryCount,
          ruleset,
          rng: matchRngState,
        });
        health = hookResult.health;
        availability = hookResult.availability;
        matchRngState = hookResult.rng;
        if (hookResult.timeline.length > 0)
          injuryTimeline = [...injuryTimeline, ...hookResult.timeline];
      }
    }
    const stepRecords = matches.filter((match) => match.step === stepIndex);
    playerCondition = applyCondition(
      playerCondition,
      stepRecords,
      ruleset.conditionRules,
      ruleset.seasonBoundaryReset.form,
    );
    return {
      results: stepMatchResultsFor(matches, stepIndex),
      records: stepRecords,
      competitions,
    };
  };

  return {
    playStepMatches,
    getMatches: () => matches,
    getCompetitions: () => competitions,
    getSchedule: () => schedule,
    getPlayerStats: () => playerStats,
    getCompetitors: () => competitors,
    getSelection: () => selection,
    getSquadRole: () => squadRole,
    getAvailability: () => availability,
    getLastRatingTenths: () => lastRatingTenths,
    getYellowSuspensionCount: () => yellowSuspensionCount,
    getSquadStatus: () => squadStatus,
    getMatchRngState: () => matchRngState,
    getPlayerCondition: () => playerCondition,
    getHealth: () => health,
    getInjuryTimeline: () => injuryTimeline,
  };
}

/**
 * T-2-001 D-25 CMD-SIM-001, T-2-002 D-26/D-34 확장. step 1 슬롯을 즉시 연다(대부분 룰셋 기본
 * 캘린더의 ROLE 필수 슬롯). `command.payload.serviceSeasonId`는 `Command` 타입 정의 주석 참조. 이
 * walk는 `eligibleEvents: []`로 도니, step 1이 EVENT 슬롯뿐인 캘린더라면 그 슬롯은 열리지 않고
 * 건너뛴다(roll 없음) — 기본 캘린더는 step 1이 필수 ROLE이라 문제되지 않는다. T-2-002: 경쟁자
 * 생성(rng 소비 — walk보다 먼저 실행해 RNG 순서를 "포지션→경쟁자→…"로 고정한다) → `context.tacticalFit`·
 * `context.squadStatus` 재계산 → 선수 현재 포지션 순위 산출 → `season.squadRole` 갱신 → walk(역할
 * 제안은 roll 없음).
 */
function startSeason(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'START_SEASON') {
    return fail('VALIDATION_FAILED', 'START_SEASON 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 START_SEASON을 받을 수 없다.`,
      {
        reason: 'NOT_ACTIVE',
      },
    );
  }
  if (state.season !== null) {
    return fail('VALIDATION_FAILED', '이미 활성 시즌이 있다.', { reason: 'SEASON_ALREADY_ACTIVE' });
  }
  if (state.contract === null) {
    return fail('VALIDATION_FAILED', '계약이 없으면 시즌을 시작할 수 없다.', {
      reason: 'NO_CONTRACT',
    });
  }
  if (state.pending !== null) {
    // T-3-003 §1: 이적시장 pending은 응답이 필수라 MARKET_OPEN으로 실패한다(advance()와 같은 규칙).
    if (state.pending.kind === 'OFFERS' || state.pending.kind === 'CONTRACT') {
      return fail(
        'VALIDATION_FAILED',
        '이적시장이 열려 있다. NEGOTIATE·ACCEPT_OFFER·REJECT_OFFER로 응답해야 한다.',
        {
          reason: 'MARKET_OPEN',
        },
      );
    }
    return fail('VALIDATION_FAILED', '이미 결정 대기 중인 pending이 있다.', {
      reason: 'PENDING_DECISION',
    });
  }
  if (state.player.profile === null) {
    throw new RangeError('startSeason: ACTIVE 상태인데 player.profile이 null이다.');
  }

  const ruleset = input.ruleset;
  const team = findTeam(ruleset, state.contract.teamId);
  const rules = ruleset.selectionRules;
  const profile = state.player.profile;

  // T-4-003: 결산에서 예약한 감독은 첫 시즌 시작 시 소비하고, 감독 교체 시즌에는 새 감독의
  // trustBase를 관계 축의 시작값으로 쓴다. 예약이 없으면 기존 결정론적 기본 감독을 만든다.
  const reservedManager = state.nextManager;
  // 팀 전환 경계에서 이미 제거했어야 하지만, 오래 저장된 상태나 외부 입력이 이전 팀 예약을 남길 수
  // 있다. manager id의 팀 접두사를 검증해 stale 예약은 버리고 현재 계약 팀의 기본 감독을 만든다.
  const reservedManagerBelongsToTeam =
    reservedManager !== null && reservedManager.id.startsWith(`${state.contract.teamId}-mgr-`);
  const manager = reservedManagerBelongsToTeam
    ? reservedManager
    : buildDefaultManager({
        teamId: state.contract.teamId,
        tacticalStyleId: team.tacticalStyleId,
        primaryPosition: profile.primaryPosition,
        seasonHistory: state.seasonHistory,
        ruleset,
      });
  // 결산은 교체·유지 모두 `nextManager`를 예약한다. 직전 SeasonResult의 id와 비교해야 유지 예약은
  // 기존 신뢰를 보존하고, 새 감독 예약만 trustBase로 초기화한다.
  const previousManagerId = state.seasonHistory.at(-1)?.result.managerId;
  const previousTeamId = state.seasonHistory.at(-1)?.teamId;
  const managerChanged =
    reservedManagerBelongsToTeam &&
    (reservedManager?.id !== previousManagerId || previousTeamId !== state.contract.teamId);
  const managerTrust = managerChanged ? manager.trustBase : state.relationships.managerTrust;

  const generatedCompetitors = generateCompetitors(ruleset, team, state.rngState);

  const tacticalFit = computeTacticalFit(
    state.attributes,
    profile.archetypeId,
    profile.primaryPosition,
    findTacticalStyle(ruleset, team.tacticalStyleId),
    rules,
    manager.preferredArchetypeIds,
  );
  const squadStatus = computeSquadStatus(
    { rolePromise: state.contract.rolePromise, captaincy: state.captaincy, lastRating: null },
    rules,
    ruleset.contractRules.squadStatusByRole,
  );
  const familiarity = familiarityOf(state.context.positionProficiency, rules);
  const selection = rankPositionForPlayer({
    ruleset,
    styleId: team.tacticalStyleId,
    position: profile.primaryPosition,
    playerName: profile.name,
    baseOvr: profile.baseOvr,
    tacticalFit,
    managerTrust,
    form: state.state.form,
    fitness: state.state.fitness,
    morale: state.state.morale,
    familiarity,
    squadStatus,
    competitors: generatedCompetitors.competitors,
  });
  const squadRole = squadRoleFromSelection(selection);

  const stateAfterSelection: CareerState = {
    ...state,
    nextManager: null,
    context: { ...state.context, tacticalFit, squadStatus },
    relationships: { ...state.relationships, managerTrust },
    rngState: generatedCompetitors.rngState,
  };

  const calendar = ruleset.leagueCalendar;
  const mode = command.payload.simulationMode;
  const initialSteps = buildSeasonSteps(calendar, mode);
  const nextRevision = snapshot.revision + 1;
  const roleContext = buildRoleContext(
    stateAfterSelection,
    ruleset,
    team.tacticalStyleId,
    selection,
    generatedCompetitors.competitors,
  );

  const league = findLeague(ruleset, team.leagueId);
  const schedule = buildSchedule(ruleset, team);
  const trainingFocus: TrainingFocus = command.payload.trainingFocus ?? 'ROLE';
  const initialCompetitions = buildInitialCompetitions(calendar);
  const initialPlayerStats = initialSeasonPlayerStats(statGroupOf(profile.primaryPosition));
  // T-2-003 오케스트레이터 리뷰 1차: 결정 스트림 상태를 그대로 복사하면 첫 경기 roll이 결정 스트림이
  // 다음에 뽑을 값과 원소 단위로 같아져(같은 xoshiro 상태 출발) 경기 결과와 이벤트 roll이 숨은
  // 상관을 갖는다. 해시 파생 시드로 완전히 떼어낸다(careerId는 안 쓴다 — fork-by-replay 뒤 시즌이
  // 그대로 같아야 하는 T-2-006 테스트가 있다).
  const initialMatchRngState = seedRng(
    `match:${state.seasonHistory.length + 1}:${stateAfterSelection.rngState.s.join(',')}`,
  );

  // T-2-005 D-39 오케스트레이터 리뷰 2차(R2-1): DEFERRED 효과는 시즌 step 번호로만 해석할 수 있으니
  // season이 배정된 뒤에만 풀 수 있다 — season 없이 미룬 효과(유스 구간 등)는 `state.deferredEffects`에
  // 쌓여 있다가 여기서 이번 시즌 `scheduledEffects`로 옮겨진다. 옮긴 뒤의 `deferredEffects`는 이번
  // 시즌 중 새로 미루는 효과를 받을 빈 목록으로 다시 시작한다. season 객체는 나머지 필드(matches·
  // schedule 등)가 walk 중 wiring closure로만 채워지므로, 여기서 예비값으로 한 번 만들어 walk에
  // 넘기고(`resolveDeferredEffects`가 walk 도중 이 예비 season의 scheduledEffects를 읽고 지운다),
  // walk가 끝난 뒤 wiring getter 값 + 갱신된 scheduledEffects로 다시 채운다.
  const initialSeason: FootballSeason = {
    index: state.seasonHistory.length + 1,
    serviceSeasonId: command.payload.serviceSeasonId,
    simulationMode: mode,
    calendarId: calendar.id,
    currentStep: 1,
    phase: findSeasonStep(initialSteps, 1).phase,
    steps: initialSteps,
    teamId: state.contract.teamId,
    styleId: team.tacticalStyleId,
    squadRole,
    squadRoleAtStart: squadRole,
    trainingFocus,
    competitions: initialCompetitions,
    schedule,
    matches: [],
    ageReferenceStep: 1,
    squad: { competitors: generatedCompetitors.competitors },
    selection,
    playerStats: initialPlayerStats,
    availability: null,
    lastRatingTenths: null,
    yellowSuspensionCount: 0,
    matchRngState: initialMatchRngState,
    scheduledEffects: state.deferredEffects,
    chapters: [],
    manager,
    injuryCount: 0,
  };
  const stateBeforeWalk: CareerState = {
    ...stateAfterSelection,
    deferredEffects: [],
    season: initialSeason,
  };

  const wiring = createStepMatchWiring(
    ruleset,
    team,
    league,
    calendar,
    team.tacticalStyleId,
    profile,
    state.contract.rolePromise,
    managerTrust,
    state.state,
    tacticalFit,
    state.context.positionProficiency,
    state.seasonHistory.length + 1,
    stateBeforeWalk,
    {
      matches: [],
      competitions: initialCompetitions,
      schedule,
      playerStats: initialPlayerStats,
      competitors: generatedCompetitors.competitors,
      selection,
      squadRole,
      availability: null,
      lastRatingTenths: null,
      yellowSuspensionCount: 0,
      squadStatus,
      matchRngState: initialMatchRngState,
      injuryCount: 0,
    },
  );

  // T-2-004 D-38: START_SEASON payload에는 chapterCandidates가 없다(ADVANCE 전용) — eligibleEvents와
  // 같은 이유로 빈 배열([])을 넘긴다. season.matches·chapters도 이 시점엔 비어 있다.
  const chapterContext: ChapterWalkContext = {
    chapterCandidates: [],
    tags: stateBeforeWalk.tags,
    resolvedChapterIds: stateBeforeWalk.resolvedChapterIds,
    existingChapterIds: [],
    league,
    seasonIndex: state.seasonHistory.length + 1,
  };
  const walked = walkToNextDecision(
    initialSteps,
    1,
    mode,
    [],
    stateBeforeWalk.rngState,
    nextRevision,
    roleContext,
    wiring.playStepMatches,
    [],
    chapterContext,
    stateBeforeWalk,
    ruleset,
  );
  const expiredState = advanceEffectsThroughWalk(
    stateBeforeWalk,
    walked,
    ruleset.relationshipRules,
  );
  if (expiredState.season === null) {
    throw new RangeError('startSeason: walk 이후 season이 null이다(있을 수 없는 상태).');
  }

  const season: FootballSeason = {
    ...initialSeason,
    currentStep: walked.currentStepIndex,
    phase: findSeasonStep(walked.steps, walked.currentStepIndex).phase,
    steps: walked.steps,
    squadRole: wiring.getSquadRole(),
    competitions: wiring.getCompetitions(),
    schedule: wiring.getSchedule(),
    matches: patchOpenedChapterMatch(wiring.getMatches(), walked.pending),
    ageReferenceStep: 1,
    squad: { competitors: wiring.getCompetitors() },
    selection: wiring.getSelection(),
    playerStats: wiring.getPlayerStats(),
    availability: wiring.getAvailability(),
    lastRatingTenths: wiring.getLastRatingTenths(),
    yellowSuspensionCount: wiring.getYellowSuspensionCount(),
    matchRngState: wiring.getMatchRngState(),
    chapters: [],
    // R2-1: walk 중 resolveDeferredEffects가 지운 뒤 남은 목록(원칙적으로 12 step을 다 걸었으니 0개).
    scheduledEffects: expiredState.season.scheduledEffects,
  };

  const nextState: CareerState = {
    ...expiredState,
    season,
    currentStep: season.currentStep,
    seasonPhase: season.phase,
    simulationMode: season.simulationMode,
    context: { ...expiredState.context, squadStatus: wiring.getSquadStatus() },
    state: wiring.getPlayerCondition(),
    health: wiring.getHealth(),
    rngState: walked.rngState,
    pending: walked.pending,
    timeline: [
      ...state.timeline,
      { revision: nextRevision, kind: 'SEASON_STARTED', refId: null, age: state.age, step: 1 },
      ...walked.passedStepIndexes.map((stepIndex) => ({
        revision: nextRevision,
        kind: 'STEP_PASSED' as const,
        refId: null,
        age: state.age,
        step: stepIndex,
      })),
      ...wiring.getInjuryTimeline(),
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'SEASON_START'),
    appliedEffects: [],
    nextAction: nextActionForPending(walked.pending),
  };
}

function isEligibleEventsSorted(events: ReadonlyArray<{ eventId: string }>): boolean {
  for (let i = 1; i < events.length; i++) {
    if (compareCodePoints(events[i - 1]!.eventId, events[i]!.eventId) > 0) return false;
  }
  return true;
}

/** T-2-001 RULE-TIME-002: pending 종류에 따라 다음에 클라이언트가 보낼 명령을 알려준다. */
function nextActionForPending(pending: Pending): 'DECISION' | 'ADVANCE' | 'SETTLEMENT' {
  if (pending === null) {
    throw new RangeError('nextActionForPending: pending이 null이다.');
  }
  switch (pending.kind) {
    case 'EVENT':
    case 'OFFERS':
    case 'ROLE_PROPOSAL':
    case 'CHAPTER':
    case 'LOAN_RETURN': // T-3-001 D-46: 임대 시즌 결산 뒤 복귀/완전 이적 결정도 사용자 결정이 필요하다(생성기는 T-3-003).
    case 'INJURY': // T-4-001 D-52: INJURY·NATIONAL_TEAM도 RESOLVE_EVENT로만 닫힌다(더 이상 자동 통과 대상이 아니다).
    case 'NATIONAL_TEAM':
      return 'DECISION';
    case 'SETTLEMENT':
      return 'SETTLEMENT';
    case 'CONTRACT':
      // T-3-003: 재계약 제안이 있으면(step 7 사전 협상) 응답이 필요하다. 없으면(잔여 계약) 자동 통과.
      return pending.offers.length > 0 ? 'DECISION' : 'ADVANCE';
  }
}

/**
 * T-2-001 D-25: 시즌이 있을 때 ADVANCE. `state.pending`이 자동 통과 대상(CHAPTER·CONTRACT)이면 그
 * step을 지나간 것으로 표시하고 다음 step으로 넘어간 뒤, 다음 결정이 열리는 step 또는 step
 * 12(SETTLEMENT)까지 한 번에 걷는다. 지나간 step마다 STEP_PASSED를 남긴다. T-2-002: ROLE 슬롯은 더
 * 이상 자동 통과 대상이 아니라 `walkToNextDecision`에 `roleContext`를 넘겨 실제 ROLE_PROPOSAL을
 * 연다(RESOLVE_ROLE로만 닫힌다). T-4-001 D-52: INJURY·NATIONAL_TEAM도 마찬가지로 자동 통과 대상에서
 * 빠졌다 — RESOLVE_EVENT로만 닫힌다.
 */
function advanceInSeason(
  input: SimulationInput,
  snapshot: DomainSnapshot,
  season: FootballSeason,
): SimulationResult {
  const command = input.command;
  if (command.type !== 'ADVANCE') {
    return fail('VALIDATION_FAILED', 'ADVANCE 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  const profile = state.player.profile;
  if (profile === null) throw new RangeError('advanceInSeason: player.profile이 null이다.');
  if (state.contract === null) throw new RangeError('advanceInSeason: contract가 null이다.');
  const eligibleEvents: EligibleEvent[] = command.payload.eligibleEvents;

  if (eligibleEvents.length > 0) {
    if (!isEligibleEventsSorted(eligibleEvents)) {
      return fail('VALIDATION_FAILED', 'eligibleEvents는 eventId 오름차순이어야 한다.', {
        reason: 'UNSORTED_ELIGIBLE_EVENTS',
      });
    }
    for (const event of eligibleEvents) {
      if (!Number.isInteger(event.weight) || event.weight <= 0) {
        return fail('VALIDATION_FAILED', 'eligibleEvents의 weight는 양의 정수여야 한다.', {
          reason: 'INVALID_WEIGHT',
        });
      }
    }
    if (eligibleEvents.length >= 2) {
      const weightSum = eligibleEvents.reduce((sum, event) => sum + event.weight, 0);
      if (weightSum > 0xffffffff) {
        return fail('VALIDATION_FAILED', 'eligibleEvents weight 합이 2^32를 넘는다.', {
          reason: 'INVALID_WEIGHT',
        });
      }
    }
  }

  const nextRevision = snapshot.revision + 1;
  let steps = season.steps;
  let timeline = state.timeline;
  let currentStepIndex = season.currentStep;

  // 현재 step이 아직 닫히지 않았으면(summary === null) decisionsOpened: 1로 닫는다. state.pending이
  // 자동 통과 대상(CHAPTER·CONTRACT·ROLE·INJURY·NATIONAL_TEAM)이면 이번 ADVANCE가 직접 닫는
  // 경우이고, pending이 이미 null이면 그 사이 RESOLVE_EVENT로 EVENT가 해소된 경우다 — 두 경우 모두
  // "이 step에 결정이 열렸었다"를 뜻한다(walkToNextDecision 불변식: 열리지 않은 step은 같은 호출
  // 안에서 즉시 닫히므로, summary === null인 step은 항상 결정이 열렸던 step이다).
  const currentStep = findSeasonStep(steps, currentStepIndex);
  if (currentStep.summary === null) {
    steps = markStepPassed(
      steps,
      currentStepIndex,
      nextRevision,
      1,
      stepMatchResultsFor(season.matches, currentStepIndex),
    );
    timeline = [
      ...timeline,
      {
        revision: nextRevision,
        kind: 'STEP_PASSED',
        refId: null,
        age: state.age,
        step: currentStepIndex,
      },
    ];
    currentStepIndex += 1;
  }

  const roleContext = buildRoleContext(
    state,
    input.ruleset,
    season.styleId,
    season.selection,
    season.squad.competitors,
  );

  const ruleset = input.ruleset;
  const team = findTeam(ruleset, season.teamId);
  const league = findLeague(ruleset, team.leagueId);
  const wiring = createStepMatchWiring(
    ruleset,
    team,
    league,
    ruleset.leagueCalendar,
    season.styleId,
    profile,
    state.contract.rolePromise,
    state.relationships.managerTrust,
    state.state,
    state.context.tacticalFit,
    state.context.positionProficiency,
    season.index,
    state,
    {
      matches: season.matches,
      competitions: season.competitions,
      schedule: season.schedule,
      playerStats: season.playerStats,
      competitors: season.squad.competitors,
      selection: season.selection,
      squadRole: season.squadRole,
      availability: season.availability,
      lastRatingTenths: season.lastRatingTenths,
      yellowSuspensionCount: season.yellowSuspensionCount,
      squadStatus: state.context.squadStatus,
      matchRngState: season.matchRngState,
      injuryCount: season.injuryCount,
    },
  );

  const chapterContext: ChapterWalkContext = {
    chapterCandidates: command.payload.chapterCandidates ?? [],
    tags: state.tags,
    resolvedChapterIds: state.resolvedChapterIds,
    existingChapterIds: season.chapters.map((chapter) => chapter.chapterId),
    league,
    seasonIndex: season.index,
  };
  const walked = walkToNextDecision(
    steps,
    currentStepIndex,
    season.simulationMode,
    eligibleEvents,
    state.rngState,
    nextRevision,
    roleContext,
    wiring.playStepMatches,
    season.matches,
    chapterContext,
    state,
    ruleset,
  );
  const expiredState = advanceEffectsThroughWalk(state, walked, ruleset.relationshipRules);
  if (expiredState.season === null) {
    throw new RangeError('advanceInSeason: walk 이후 season이 null이다(있을 수 없는 상태).');
  }
  timeline = [
    ...timeline,
    ...walked.passedStepIndexes.map((stepIndex) => ({
      revision: nextRevision,
      kind: 'STEP_PASSED' as const,
      refId: null,
      age: state.age,
      step: stepIndex,
    })),
    ...wiring.getInjuryTimeline(),
  ];

  const nextSeason: FootballSeason = {
    ...season,
    steps: walked.steps,
    currentStep: walked.currentStepIndex,
    phase: findSeasonStep(walked.steps, walked.currentStepIndex).phase,
    squadRole: wiring.getSquadRole(),
    competitions: wiring.getCompetitions(),
    schedule: wiring.getSchedule(),
    matches: patchOpenedChapterMatch(wiring.getMatches(), walked.pending),
    squad: { competitors: wiring.getCompetitors() },
    selection: wiring.getSelection(),
    playerStats: wiring.getPlayerStats(),
    availability: wiring.getAvailability(),
    lastRatingTenths: wiring.getLastRatingTenths(),
    yellowSuspensionCount: wiring.getYellowSuspensionCount(),
    matchRngState: wiring.getMatchRngState(),
    // T-2-005 D-39 오케스트레이터 리뷰 2차(R2-1): walk 중 resolveDeferredEffects가 이 시즌의
    // scheduledEffects에서 이번에 해석된 항목을 지운다 — season(위 ...season)은 walk 이전 값이라
    // 그대로 두면 지워진 항목이 되살아난다. expiredState.season의 값으로 덮어써야 한다.
    scheduledEffects: expiredState.season.scheduledEffects,
  };

  const nextState: CareerState = {
    ...expiredState,
    season: nextSeason,
    currentStep: nextSeason.currentStep,
    seasonPhase: nextSeason.phase,
    context: { ...expiredState.context, squadStatus: wiring.getSquadStatus() },
    state: wiring.getPlayerCondition(),
    health: wiring.getHealth(),
    rngState: walked.rngState,
    pending: walked.pending,
    timeline,
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'STEP_BOUNDARY'),
    appliedEffects: [],
    nextAction: nextActionForPending(walked.pending),
  };
}

function advance(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'ADVANCE') {
    return fail('VALIDATION_FAILED', 'ADVANCE 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${state.status}일 때는 ADVANCE를 받을 수 없다.`, {
      reason: 'NOT_ACTIVE',
    });
  }
  const canAutoPassPending = state.season !== null && isAutoPassablePending(state.pending);
  if (state.pending !== null && !canAutoPassPending) {
    // T-3-003 §1: 이적시장 pending(OFFERS·제안 있는 CONTRACT)은 응답이 필수라 일반 PENDING_DECISION이
    // 아니라 더 구체적인 MARKET_OPEN으로 실패한다(웹이 NEGOTIATE·ACCEPT_OFFER·REJECT_OFFER로 안내).
    if (state.pending.kind === 'OFFERS' || state.pending.kind === 'CONTRACT') {
      return fail(
        'VALIDATION_FAILED',
        '이적시장이 열려 있다. NEGOTIATE·ACCEPT_OFFER·REJECT_OFFER로 응답해야 한다.',
        {
          reason: 'MARKET_OPEN',
        },
      );
    }
    return fail('VALIDATION_FAILED', '이미 결정 대기 중인 pending이 있다.', {
      reason: 'PENDING_DECISION',
    });
  }

  if (state.season !== null) {
    return advanceInSeason(input, snapshot, state.season);
  }

  const eligibleEvents = command.payload.eligibleEvents;

  if (eligibleEvents.length > 0) {
    if (!isEligibleEventsSorted(eligibleEvents)) {
      return fail('VALIDATION_FAILED', 'eligibleEvents는 eventId 오름차순이어야 한다.', {
        reason: 'UNSORTED_ELIGIBLE_EVENTS',
      });
    }
    for (const event of eligibleEvents) {
      if (!Number.isInteger(event.weight) || event.weight <= 0) {
        return fail('VALIDATION_FAILED', 'eligibleEvents의 weight는 양의 정수여야 한다.', {
          reason: 'INVALID_WEIGHT',
        });
      }
    }

    let chosen = eligibleEvents[0]!;
    let nextRngState = state.rngState;
    if (eligibleEvents.length >= 2) {
      const weightSum = eligibleEvents.reduce((sum, event) => sum + event.weight, 0);
      if (weightSum > 0xffffffff) {
        return fail('VALIDATION_FAILED', 'eligibleEvents weight 합이 2^32를 넘는다.', {
          reason: 'INVALID_WEIGHT',
        });
      }
      const rolled = rollRange(state.rngState, 1, weightSum);
      nextRngState = rolled.state;
      let cumulative = 0;
      for (const event of eligibleEvents) {
        cumulative += event.weight;
        if (rolled.value <= cumulative) {
          chosen = event;
          break;
        }
      }
    }

    const nextState: CareerState = {
      ...state,
      rngState: nextRngState,
      pending: { kind: 'EVENT', eventId: chosen.eventId, version: chosen.version },
    };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'EVENT_OFFERED'),
      appliedEffects: [],
      nextAction: 'DECISION',
    };
  }

  if (state.contract === null) {
    const branch = findMatchingOfferBranch(input.ruleset.offerRules, state.tags);
    if (branch !== null) {
      if (state.player.profile === null) {
        throw new RangeError('advance: ACTIVE 상태인데 player.profile이 null이다.');
      }
      const nextRevision = snapshot.revision + 1;
      const generated = generateOffers(
        input.ruleset,
        branch,
        state.tags,
        state.player.profile.baseOvr,
        state.player.profile.primaryPosition,
        nextRevision,
        state.rngState,
      );
      const nextState: CareerState = {
        ...state,
        rngState: generated.rngState,
        pending: {
          kind: 'OFFERS',
          offers: generated.offers,
          // T-3-001 D-43: Phase 1 첫 계약 시장. 안전 잔류 제안 생성기는 T-3-002 몫이라 지금은 null.
          market: {
            openedAtRevision: nextRevision,
            seasonIndex: state.seasonHistory.length,
            reason: 'FIRST_CONTRACT',
            safeOfferId: null,
          },
        },
      };
      return {
        ok: true,
        snapshot: buildSnapshot(nextState, nextRevision, 'CHAPTER_DECISION'),
        appliedEffects: [],
        nextAction: 'DECISION',
      };
    }
  }

  if (state.seasonPhase !== 'SETTLEMENT') {
    const nextStep = state.currentStep + 1;
    const expired = expireEffects(state, nextStep);
    const nextState: CareerState = { ...expired, currentStep: nextStep };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, snapshot.revision + 1, 'STEP_BOUNDARY'),
      appliedEffects: [],
      nextAction: nextStep === 12 ? 'SETTLEMENT' : 'DECISION',
    };
  }

  return fail('VALIDATION_FAILED', '더 진행할 결정이 없다.', { reason: 'NOTHING_TO_ADVANCE' });
}

function resolveEvent(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'RESOLVE_EVENT') {
    return fail('VALIDATION_FAILED', 'RESOLVE_EVENT 처리기에 다른 명령이 전달되었다.');
  }

  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 RESOLVE_EVENT를 받을 수 없다.`,
      {
        reason: 'NOT_ACTIVE',
      },
    );
  }

  const pending = state.pending;
  // T-4-001 D-52: EVENT 외에 INJURY·NATIONAL_TEAM pending도 이 명령으로 닫는다(eventId·version 일치
  // 검사는 셋 다 같다 — 세 kind 모두 eventId·version 필드를 갖는다).
  if (
    pending === null ||
    (pending.kind !== 'EVENT' && pending.kind !== 'INJURY' && pending.kind !== 'NATIONAL_TEAM')
  ) {
    return fail('VALIDATION_FAILED', '해소할 pending 이벤트가 없다.', {
      reason: 'NO_PENDING_EVENT',
    });
  }
  if (
    pending.eventId !== command.payload.eventId ||
    pending.version !== command.payload.definitionVersion
  ) {
    return fail('VALIDATION_FAILED', 'pending 이벤트와 요청이 다르다.', {
      reason: 'PENDING_EVENT_MISMATCH',
    });
  }

  const rehabPlan = command.payload.rehabPlan;
  const callUp = command.payload.callUp;
  if (pending.kind === 'EVENT' && (rehabPlan !== undefined || callUp !== undefined)) {
    return fail('VALIDATION_FAILED', 'EVENT pending에는 rehabPlan·callUp을 보낼 수 없다.', {
      reason: 'PAYLOAD_KIND_MISMATCH',
    });
  }
  if (pending.kind === 'INJURY' && rehabPlan === undefined) {
    return fail('VALIDATION_FAILED', 'INJURY pending은 rehabPlan이 필요하다.', {
      reason: 'REHAB_PLAN_REQUIRED',
    });
  }
  if (pending.kind === 'NATIONAL_TEAM' && callUp === undefined) {
    return fail('VALIDATION_FAILED', 'NATIONAL_TEAM pending은 callUp이 필요하다.', {
      reason: 'CALL_UP_REQUIRED',
    });
  }

  let episodeIndex = -1;
  if (pending.kind === 'INJURY') {
    episodeIndex = state.health.episodes.findIndex((episode) => episode.id === pending.episodeId);
    if (episodeIndex === -1) {
      return fail('VALIDATION_FAILED', 'pending.episodeId의 부상 기록을 찾지 못했다.', {
        reason: 'EPISODE_NOT_FOUND',
      });
    }
  }

  const outcomes = command.payload.outcomes;
  const weightSum = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
  // rollInt는 maxExclusive가 1 이상의 정수가 아니면 throw한다(프로그래밍 오류 가정). 여기서
  // 미리 검증해 simulate()가 throw하지 않는다는 규칙을 content 데이터 오류로도 어기지 않게 한다.
  if (!Number.isInteger(weightSum) || weightSum <= 0 || weightSum > 0xffffffff) {
    return fail('VALIDATION_FAILED', 'outcome 가중치 합은 1 이상 2^32 이하의 정수여야 한다.');
  }

  const rolled = rollInt(state.rngState, weightSum);
  let cumulative = 0;
  let chosen = outcomes[0];
  for (const outcome of outcomes) {
    cumulative += outcome.weight;
    if (rolled.value < cumulative) {
      chosen = outcome;
      break;
    }
  }
  if (chosen === undefined) {
    return fail('VALIDATION_FAILED', 'outcomes가 비어 있다.');
  }

  const effectResult = applyEffects(
    state,
    chosen.effects,
    { step: state.currentStep },
    input.ruleset.relationshipRules,
  );

  let tags = effectResult.state.tags;
  if (chosen.addTags && chosen.addTags.length > 0) {
    tags = [...tags, ...chosen.addTags];
  }
  if (chosen.removeTags && chosen.removeTags.length > 0) {
    const removeSet = new Set(chosen.removeTags);
    tags = tags.filter((tag) => !removeSet.has(tag));
  }
  tags = sortUniqueTags(tags);

  const nextRevision = snapshot.revision + 1;

  // T-4-001 D-52: INJURY는 재활 계획을 에피소드에 적용하고 REHAB_CHOSEN을, NATIONAL_TEAM은 응답에
  // 따라 NATIONAL_TEAM_CALLED/DECLINED를 추가 타임라인으로 남긴다(둘 다 EVENT_RESOLVED 다음).
  let health = effectResult.state.health;
  const extraTimeline: TimelineEntry[] = [];
  if (pending.kind === 'INJURY') {
    const episode = health.episodes[episodeIndex]!;
    const updated = applyRehabPlan(episode, rehabPlan as RehabPlan, input.ruleset.injuryRules);
    health = {
      episodes: health.episodes.map((candidate, i) => (i === episodeIndex ? updated : candidate)),
    };
    extraTimeline.push({
      revision: nextRevision,
      kind: 'REHAB_CHOSEN',
      refId: pending.episodeId,
      age: state.age,
      step: state.currentStep,
    });
  } else if (pending.kind === 'NATIONAL_TEAM') {
    const kind = callUp === 'DECLINE' ? 'NATIONAL_TEAM_DECLINED' : 'NATIONAL_TEAM_CALLED';
    extraTimeline.push({
      revision: nextRevision,
      kind,
      refId: command.payload.eventId,
      age: state.age,
      step: state.currentStep,
    });
  }

  const nextState: CareerState = {
    ...effectResult.state,
    tags,
    health,
    controversyFailures:
      state.controversyFailures +
      (chosen.kind === 'FAIL' &&
      (command.payload.eventId.startsWith('EVT-ETH-') ||
        command.payload.eventId.startsWith('EVT-MEDIA-'))
        ? 1
        : 0),
    resolvedEventIds: [...state.resolvedEventIds, command.payload.eventId],
    rngState: rolled.state,
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'EVENT_RESOLVED',
        refId: `${command.payload.eventId}:${command.payload.choiceId}:${chosen.id}`,
        age: state.age,
        step: state.currentStep,
      },
      ...extraTimeline,
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'EVENT_RESOLVED'),
    roll: rolled.value,
    outcomeId: chosen.id,
    appliedEffects: effectResult.applied,
    nextAction: 'ADVANCE',
  };
}

/**
 * T-2-004 D-38 CMD-SIM-005: CHAPTER pending의 판단 하나를 닫는다. 검증·roll·Effect·평점·태그·
 * `ChapterRecord` 조립은 전부 `chapter.ts`의 `resolveChapter`(순수 함수)가 한다 — 여기서는 status
 * ACTIVE 검사(다른 명령들과 같은 메시지 관례)와 timeline 조립, checkpoint·nextAction만 정한다.
 */
function resolveChapterCommand(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'RESOLVE_CHAPTER') {
    return fail('VALIDATION_FAILED', 'RESOLVE_CHAPTER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 RESOLVE_CHAPTER를 받을 수 없다.`,
      {
        reason: 'NOT_ACTIVE',
      },
    );
  }

  const result = resolveChapter({
    state,
    ruleset: input.ruleset,
    chapterId: command.payload.chapterId,
    definitionVersion: command.payload.definitionVersion,
    decisionId: command.payload.decisionId,
    optionId: command.payload.optionId,
    outcomes: command.payload.outcomes,
  });

  if (!result.ok) {
    return result.reason === undefined
      ? fail('VALIDATION_FAILED', result.message)
      : fail('VALIDATION_FAILED', result.message, { reason: result.reason });
  }

  const nextRevision = snapshot.revision + 1;
  const nextState: CareerState = {
    ...result.state,
    timeline: [
      ...result.state.timeline,
      {
        revision: nextRevision,
        kind: 'CHAPTER_RESOLVED',
        refId: `${command.payload.chapterId}:${command.payload.decisionId}:${command.payload.optionId}:${result.outcomeId}`,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CHAPTER_DECISION'),
    roll: result.roll,
    outcomeId: result.outcomeId,
    appliedEffects: result.appliedEffects,
    nextAction: nextActionAfterChapterResolve(nextState.pending),
  };
}

/**
 * `RESOLVE_CHAPTER`는 `nextActionForPending`(pending이 null이면 throw)과 달리 pending이 null(마지막
 * 판단 확정)인 경우도 유효해서 별도 함수로 뺐다 — null이면 다음 경기로 ADVANCE, 아니면(같은 챕터의
 * 다음 판단) DECISION이다.
 */
function nextActionAfterChapterResolve(pending: Pending): 'DECISION' | 'ADVANCE' {
  return pending === null ? 'ADVANCE' : 'DECISION';
}

// T-3-003 §2: NEGOTIATE ROLE ask 성공 시 한 단계 위로(RESERVE→BENCH→ROTATION→STARTER, STARTER는
// 전제 조건(§2)에서 이미 막는다).
const ROLE_UPGRADE: Record<SquadRole, SquadRole> = {
  RESERVE: 'BENCH',
  BENCH: 'ROTATION',
  ROTATION: 'STARTER',
  STARTER: 'STARTER',
};

// T-3-003 §2: `NegotiationAsk`(대문자)와 `Offer.negotiable`의 필드 키(소문자)를 잇는다.
const NEGOTIATION_ASK_KEY: Record<NegotiationAsk, 'wage' | 'role' | 'length'> = {
  WAGE: 'wage',
  ROLE: 'role',
  LENGTH: 'length',
};

/** 현재 열린 stint(`toSeasonIndex === null`)를 찾아 마감한다. clubHistory는 항상 열린 stint 1개를 가진다. */
function closeOpenStint(
  clubHistory: readonly ClubStint[],
  toSeasonIndex: number,
  endReason: ClubStintEndReason,
): ClubStint[] {
  return clubHistory.map((stint) =>
    stint.toSeasonIndex === null ? { ...stint, toSeasonIndex, endReason } : stint,
  );
}

/** T-3-003 §4 RENEWAL: 클럽·stint는 그대로 두고 열린 stint의 contractId만 새 계약 id로 바꾼다. */
function swapOpenStintContract(
  clubHistory: readonly ClubStint[],
  newContractId: string,
): ClubStint[] {
  return clubHistory.map((stint) =>
    stint.toSeasonIndex === null ? { ...stint, contractId: newContractId } : stint,
  );
}

/** T-3-003 §4: `transferRules.rivalPairs`는 순서 없는 쌍이라 양방향으로 검사한다. */
function isRivalPair(ruleset: Ruleset, fromTeamId: string, toTeamId: string): boolean {
  return ruleset.transferRules.rivalPairs.some(
    ([a, b]) => (a === fromTeamId && b === toTeamId) || (a === toTeamId && b === fromTeamId),
  );
}

type OfferLookup =
  { ok: true; offer: Offer } | { ok: false; reason: 'OFFER_NOT_FOUND' | 'OFFER_EXPIRED' };

/** 원본 목록(만료 전)엔 없으면 OFFER_NOT_FOUND, 있었지만 만료로 빠졌으면 OFFER_EXPIRED. */
function lookupKeptOffer(
  originalOffers: readonly Offer[],
  kept: readonly Offer[],
  offerId: string,
): OfferLookup {
  const original = originalOffers.find((candidate) => candidate.id === offerId);
  if (original === undefined) return { ok: false, reason: 'OFFER_NOT_FOUND' };
  const offer = kept.find((candidate) => candidate.id === offerId);
  if (offer === undefined) return { ok: false, reason: 'OFFER_EXPIRED' };
  return { ok: true, offer };
}

type MarketOffersPrep = { kept: Offer[]; timelineAdds: TimelineEntry[] };

/**
 * T-3-003 §1 공통 전처리: NEGOTIATE·ACCEPT_OFFER·REJECT_OFFER가 `pending.kind`가 `OFFERS`·`CONTRACT`인
 * 제안을 다루기 전에 먼저 `expireOffers`로 만료분을 제거하고 제안마다 `OFFER_EXPIRED`를 남긴다(안전
 * 잔류는 `validUntilRevision === null`이라 남지 않는다).
 */
function prepareMarketOffers(
  pending: Extract<Pending, { kind: 'OFFERS' | 'CONTRACT' }>,
  nextRevision: number,
  age: number,
  step: number,
): MarketOffersPrep {
  const { kept, expired } = expireOffers(pending.offers, nextRevision);
  const timelineAdds: TimelineEntry[] = expired.map((offer) => ({
    revision: nextRevision,
    kind: 'OFFER_EXPIRED',
    refId: offer.id,
    age,
    step,
  }));
  return { kept, timelineAdds };
}

/** 시장 응답이 닫힐 때 제거하는 선언 태그. 이적 판정은 제거 전에 원본 태그를 읽어야 한다. */
function stripMarketDeclarationTags(tags: readonly string[]): string[] {
  return sortUniqueTags(tags.filter((tag) => tag !== '이적_희망' && tag !== '잔류_선언'));
}

/**
 * T-3-003 §3/§4 "잔류": 계약·팀·context·관계는 손대지 않고, `이적_희망`·`잔류_선언` 태그만 제거한 뒤
 * pending을 닫는다. REJECT_OFFER(null, OFFERS)와 ACCEPT_OFFER(안전 잔류)가 공유한다.
 */
function buildStayState(state: CareerState, nextRevision: number): CareerState {
  return {
    ...state,
    pending: null,
    tags: stripMarketDeclarationTags(state.tags),
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'OFFER_REJECTED',
        refId: 'ALL',
        age: state.age,
        step: state.currentStep,
      },
    ],
  };
}

type NewClubTransition = {
  context: CareerState['context'];
  relationships: CareerState['relationships'];
  tags: string[];
  captaincy: CareerState['captaincy'];
  captaincySeasons: CareerState['captaincySeasons'];
};

/**
 * T-3-003 §4 TRANSFER·FREE_AGENT·LOAN 공통 context·관계 전환(D-45). `applyMoveEffects`가 false면(LOAN)
 * 라이벌·약속 위반 이적의 팬 델타와 `배신_이적` 태그를 적용하지 않는다(임대는 배신이 아니다).
 */
function buildNewClubTransition(
  state: CareerState,
  ruleset: Ruleset,
  previousContract: Contract,
  offer: Offer,
  applyMoveEffects: boolean,
): NewClubTransition {
  const carryRules = ruleset.transferRules.relationshipCarry;
  const isRivalMove =
    applyMoveEffects &&
    (isRivalPair(ruleset, previousContract.teamId, offer.teamId) ||
      state.tags.includes('잔류_선언'));
  const isPromiseBreachMove = applyMoveEffects && previousContract.promiseBreaches >= 1;

  const profile = state.player.profile;
  const positionProficiency =
    profile !== null && offer.positionPlan === profile.primaryPosition
      ? state.context.positionProficiency
      : ruleset.contractRules.imposedPositionProficiency;

  const fans = clamp(
    Math.floor((state.relationships.fans * carryRules.fansCarryBp) / 10000) +
      (isRivalMove ? carryRules.rivalMoveFansDelta : 0) +
      (isPromiseBreachMove ? carryRules.promiseBreachMoveFansDelta : 0),
    0,
    100,
  );

  return {
    context: {
      tacticalFit: offer.tacticalFitEstimate,
      squadStatus: ruleset.contractRules.squadStatusByRole[offer.rolePromise],
      positionProficiency,
    },
    relationships: {
      managerTrust: carryRules.newManagerTrustBase,
      captain: 0,
      rival: 0,
      fans,
      agent: state.relationships.agent,
    },
    tags: stripMarketDeclarationTags(isRivalMove ? [...state.tags, '배신_이적'] : state.tags),
    captaincy: 'NONE',
    captaincySeasons: 0,
  };
}

/**
 * T-3-001 D-52, T-3-003 §2: NEGOTIATE — roll 정확히 1회. `pending.kind`가 `OFFERS`·`CONTRACT`일 때만
 * 받는다. 성공(`COUNTERED`)이면 ask별로 조건을 올리고, 실패(`WITHDRAWN`)면 그 제안을 목록에서 뺀다.
 * pending은 같은 kind로 유지된다(다른 제안·안전 잔류는 그대로).
 */
function negotiateOffer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'NEGOTIATE') {
    return fail('VALIDATION_FAILED', 'NEGOTIATE 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail('VALIDATION_FAILED', `status가 ${state.status}일 때는 NEGOTIATE를 받을 수 없다.`, {
      reason: 'NOT_ACTIVE',
    });
  }
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) {
    return fail('VALIDATION_FAILED', '결정 대기 중인 이적시장 제안이 없다.', {
      reason: 'NO_PENDING_OFFERS',
    });
  }

  const nextRevision = snapshot.revision + 1;
  const { kept, timelineAdds } = prepareMarketOffers(
    pending,
    nextRevision,
    state.age,
    state.currentStep,
  );
  const { offerId, ask } = command.payload;
  const lookup = lookupKeptOffer(pending.offers, kept, offerId);
  if (!lookup.ok) {
    return fail(
      'VALIDATION_FAILED',
      lookup.reason === 'OFFER_NOT_FOUND' ? '제안 목록에 없는 offerId다.' : '대상 제안이 만료됐다.',
      {
        reason: lookup.reason,
      },
    );
  }
  const offer = lookup.offer;

  const askKey = NEGOTIATION_ASK_KEY[ask];
  if (
    !canNegotiate(offer) ||
    !offer.negotiable[askKey] ||
    offer.negotiatedAsk !== null ||
    (ask === 'ROLE' && offer.rolePromise === 'STARTER')
  ) {
    return fail('VALIDATION_FAILED', '이 제안은 이 항목을 협상할 수 없다.', {
      reason: 'NOT_NEGOTIABLE',
    });
  }

  const ruleset = input.ruleset;
  const negotiationRules = ruleset.transferRules.negotiation;
  const team = findTeam(ruleset, offer.teamId);
  const successBp = clamp(
    negotiationRules.successBp[offer.kind][ask] +
      negotiationRules.reputationAdjustBpPerPoint * (team.reputation - 3),
    0,
    10000,
  );

  const roll = rollInt(state.rngState, 10000);
  const succeeded = roll.value < successBp;

  let nextOffers: Offer[];
  let refIdSuffix: 'COUNTERED' | 'WITHDRAWN';
  if (succeeded) {
    refIdSuffix = 'COUNTERED';
    let countered: Offer = { ...offer, negotiationState: 'COUNTERED', negotiatedAsk: ask };
    if (ask === 'WAGE') {
      countered = {
        ...countered,
        wageMinorPerWeek: Math.floor(
          (offer.wageMinorPerWeek * negotiationRules.counter.wageBp) / 10000,
        ),
      };
    } else if (ask === 'LENGTH') {
      countered = {
        ...countered,
        lengthSeasons: Math.min(
          offer.lengthSeasons + negotiationRules.counter.lengthDelta,
          ruleset.offerRules.lengthSeasons.max,
        ),
      };
    } else {
      const upgradedRole = ROLE_UPGRADE[offer.rolePromise];
      countered = {
        ...countered,
        rolePromise: upgradedRole,
        appearancePromise: {
          minutesShareBp: ruleset.contractRules.promiseMinutesShareBp[upgradedRole],
        },
      };
    }
    nextOffers = kept.map((candidate) => (candidate.id === offer.id ? countered : candidate));
  } else {
    refIdSuffix = 'WITHDRAWN';
    nextOffers = kept.filter((candidate) => candidate.id !== offer.id);
  }

  const nextState: CareerState = {
    ...state,
    rngState: roll.state,
    pending: { ...pending, offers: nextOffers },
    timeline: [
      ...state.timeline,
      ...timelineAdds,
      {
        revision: nextRevision,
        kind: 'NEGOTIATED',
        refId: `${offer.id}:${ask}:${refIdSuffix}`,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'STEP_BOUNDARY'),
    appliedEffects: [],
    nextAction: 'DECISION',
  };
}

/**
 * T-3-001 D-52, T-3-003 §3: REJECT_OFFER — rng 없음. `offerId` 개별 거절은 그 제안만 제거한다(안전
 * 잔류는 개별 거절 불가). `offerId: null`(전부 거절)은 `OFFERS`면 안전 잔류 수락과 같은 결과, `CONTRACT`면
 * pending을 그냥 닫는다(다음 결산에서 만료 시장이 열린다).
 */
function rejectOffer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'REJECT_OFFER') {
    return fail('VALIDATION_FAILED', 'REJECT_OFFER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 REJECT_OFFER를 받을 수 없다.`,
      { reason: 'NOT_ACTIVE' },
    );
  }
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) {
    return fail('VALIDATION_FAILED', '결정 대기 중인 이적시장 제안이 없다.', {
      reason: 'NO_PENDING_OFFERS',
    });
  }

  const nextRevision = snapshot.revision + 1;
  const { kept, timelineAdds } = prepareMarketOffers(
    pending,
    nextRevision,
    state.age,
    state.currentStep,
  );
  const { offerId } = command.payload;

  if (offerId !== null) {
    const lookup = lookupKeptOffer(pending.offers, kept, offerId);
    if (!lookup.ok) {
      return fail(
        'VALIDATION_FAILED',
        lookup.reason === 'OFFER_NOT_FOUND'
          ? '제안 목록에 없는 offerId다.'
          : '대상 제안이 만료됐다.',
        {
          reason: lookup.reason,
        },
      );
    }
    if (offerId === pending.market.safeOfferId) {
      return fail('VALIDATION_FAILED', '안전 잔류 제안은 개별 거절할 수 없다.', {
        reason: 'SAFE_OFFER',
      });
    }
    const nextOffers = kept.filter((candidate) => candidate.id !== offerId);
    const nextState: CareerState = {
      ...state,
      pending: { ...pending, offers: nextOffers },
      timeline: [
        ...state.timeline,
        ...timelineAdds,
        {
          revision: nextRevision,
          kind: 'OFFER_REJECTED',
          refId: offerId,
          age: state.age,
          step: state.currentStep,
        },
      ],
    };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, nextRevision, 'STEP_BOUNDARY'),
      appliedEffects: [],
      nextAction: 'DECISION',
    };
  }

  const stateWithExpiry: CareerState = { ...state, timeline: [...state.timeline, ...timelineAdds] };

  if (pending.kind === 'OFFERS') {
    const nextState = buildStayState(stateWithExpiry, nextRevision);
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
      appliedEffects: [],
      nextAction: 'ADVANCE',
    };
  }

  const nextState: CareerState = {
    ...stateWithExpiry,
    pending: null,
    timeline: [
      ...stateWithExpiry.timeline,
      {
        revision: nextRevision,
        kind: 'OFFER_REJECTED',
        refId: 'ALL',
        age: state.age,
        step: state.currentStep,
      },
    ],
  };
  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * T-3-001 Phase 1 첫 계약 경로(회귀 금지) — `pending.market.reason === 'FIRST_CONTRACT'`일 때만
 * `acceptOffer`가 호출한다. 지금 코드 그대로다(T-3-003 §1 전처리는 FIRST_CONTRACT 제안이 항상
 * `validUntilRevision: null`이라 실질적으로 no-op).
 */
function acceptFirstContractOffer(
  state: CareerState,
  ruleset: Ruleset,
  offer: Offer,
  nextRevision: number,
): SimulationResult {
  if (state.player.profile === null) {
    throw new RangeError('acceptFirstContractOffer: player.profile이 null이다.');
  }
  const backgroundId = state.player.profile.backgroundId;
  const background = ruleset.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (background === undefined) {
    throw new RangeError(`acceptFirstContractOffer: 룰셋에 backgroundId '${backgroundId}'가 없다.`);
  }

  const stage: CareerStage = offer.leagueTier === 'YOUTH' ? 'YOUTH' : 'PRO';
  const isNewClub = offer.teamId !== background.startTeamId;
  const signedSeasonIndex = state.seasonHistory.length + 1;

  const contract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: offer.id,
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    lengthSeasons: offer.lengthSeasons,
    wageMinorPerWeek: offer.wageMinorPerWeek,
    signingBonusMinor: offer.signingBonusMinor,
    rolePromise: offer.rolePromise,
    shirtNumber: offer.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
    // T-3-001 D-44/D-45: Phase 1 첫 계약은 항상 'PERMANENT'(임대 전환은 T-3-003).
    kind: 'PERMANENT',
    appearancePromise: offer.appearancePromise,
    positionPlan: offer.positionPlan,
    suspended: false,
    loan: null,
    promiseBreaches: 0,
    signedSeasonIndex,
  };

  const clubStint: ClubStint = {
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    kind: contract.kind,
    fromSeasonIndex: signedSeasonIndex,
    toSeasonIndex: null,
    endReason: null,
    contractId: contract.id,
  };

  const nextState: CareerState = {
    ...state,
    stage,
    contract,
    nextManager: null,
    captaincy: isNewClub ? 'NONE' : state.captaincy,
    captaincySeasons: isNewClub ? 0 : state.captaincySeasons,
    clubHistory: [...state.clubHistory, clubStint],
    pending: null,
    context: {
      ...state.context,
      squadStatus: ruleset.contractRules.squadStatusByRole[offer.rolePromise],
      tacticalFit: offer.tacticalFitEstimate,
    },
    relationships: isNewClub
      ? { ...state.relationships, managerTrust: ruleset.contractRules.newClubManagerTrust }
      : state.relationships,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'CONTRACT_SIGNED',
        refId: contract.id,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'SETTLEMENT',
  };
}

/**
 * T-3-003 §4 RENEWAL(step 7 사전 협상·EXPIRED 안전 잔류·협상된 RENEWAL 공통): 같은 클럽 재계약. 팀·
 * context·관계·clubHistory 항목은 건드리지 않고 현재 열린 stint의 contractId만 새 계약 id로 바꾼다.
 */
function acceptRenewalOffer(
  state: CareerState,
  offer: Offer,
  nextRevision: number,
): SimulationResult {
  const signedSeasonIndex =
    state.season !== null ? state.season.index + 1 : state.seasonHistory.length + 1;
  const newContract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: offer.id,
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    lengthSeasons: offer.lengthSeasons,
    wageMinorPerWeek: offer.wageMinorPerWeek,
    signingBonusMinor: offer.signingBonusMinor,
    rolePromise: offer.rolePromise,
    shirtNumber: offer.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
    kind: 'PERMANENT',
    appearancePromise: offer.appearancePromise,
    positionPlan: offer.positionPlan,
    suspended: false,
    loan: null,
    promiseBreaches: 0,
    signedSeasonIndex,
  };

  const nextState: CareerState = {
    ...state,
    contract: newContract,
    clubHistory: swapOpenStintContract(state.clubHistory, newContract.id),
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'CONTRACT_RENEWED',
        refId: newContract.id,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/** T-3-003 §4 TRANSFER·FREE_AGENT: 현재 stint를 마감하고 새 클럽에서 새 Contract·stint를 연다. */
function acceptNewClubOffer(
  state: CareerState,
  ruleset: Ruleset,
  contract: Contract,
  offer: Offer,
  nextRevision: number,
): SimulationResult {
  const transition = buildNewClubTransition(state, ruleset, contract, offer, true);
  const stage: CareerStage = offer.leagueTier === 'YOUTH' ? 'YOUTH' : 'PRO';
  const signedSeasonIndex = state.seasonHistory.length + 1;

  const newContract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: offer.id,
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    lengthSeasons: offer.lengthSeasons,
    wageMinorPerWeek: offer.wageMinorPerWeek,
    signingBonusMinor: offer.signingBonusMinor,
    rolePromise: offer.rolePromise,
    shirtNumber: offer.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
    kind: 'PERMANENT',
    appearancePromise: offer.appearancePromise,
    positionPlan: offer.positionPlan,
    suspended: false,
    loan: null,
    promiseBreaches: 0,
    signedSeasonIndex,
  };

  const endReason: ClubStintEndReason = offer.kind === 'TRANSFER' ? 'TRANSFERRED' : 'EXPIRED';
  const closedHistory = closeOpenStint(state.clubHistory, state.seasonHistory.length, endReason);
  const newStint: ClubStint = {
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    kind: 'PERMANENT',
    fromSeasonIndex: signedSeasonIndex,
    toSeasonIndex: null,
    endReason: null,
    contractId: newContract.id,
  };

  const nextState: CareerState = {
    ...state,
    stage,
    contract: newContract,
    nextManager: null,
    clubHistory: [...closedHistory, newStint],
    context: transition.context,
    relationships: transition.relationships,
    captaincy: transition.captaincy,
    captaincySeasons: transition.captaincySeasons,
    tags: transition.tags,
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: offer.kind === 'TRANSFER' ? 'TRANSFERRED' : 'CONTRACT_SIGNED',
        refId: newContract.id,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * T-3-003 §4 LOAN(D-46): 원소속 계약을 `parentContract`(suspended: true)로 보관하고, 임대 구단에서 새
 * Contract(kind LOAN)·stint를 연다. context·관계 전환은 TRANSFER와 같되 라이벌·`배신_이적`은 적용하지
 * 않는다(임대는 배신이 아니다).
 */
function acceptLoanOffer(
  state: CareerState,
  ruleset: Ruleset,
  contract: Contract,
  offer: Offer,
  nextRevision: number,
): SimulationResult {
  const transition = buildNewClubTransition(state, ruleset, contract, offer, false);
  const stage: CareerStage = offer.leagueTier === 'YOUTH' ? 'YOUTH' : 'PRO';
  const signedSeasonIndex = state.seasonHistory.length + 1;

  const loanContract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: offer.id,
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    lengthSeasons: 1,
    wageMinorPerWeek: offer.wageMinorPerWeek,
    signingBonusMinor: offer.signingBonusMinor,
    rolePromise: offer.rolePromise,
    shirtNumber: offer.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
    kind: 'LOAN',
    appearancePromise: offer.appearancePromise,
    positionPlan: offer.positionPlan,
    suspended: false,
    loan: offer.loan,
    promiseBreaches: 0,
    signedSeasonIndex,
  };

  const closedHistory = closeOpenStint(state.clubHistory, state.seasonHistory.length, 'LOANED');
  const newStint: ClubStint = {
    teamId: offer.teamId,
    teamName: offer.teamName,
    leagueTier: offer.leagueTier,
    kind: 'LOAN',
    fromSeasonIndex: signedSeasonIndex,
    toSeasonIndex: null,
    endReason: null,
    contractId: loanContract.id,
  };

  const nextState: CareerState = {
    ...state,
    stage,
    contract: loanContract,
    parentContract: { ...contract, suspended: true },
    nextManager: null,
    clubHistory: [...closedHistory, newStint],
    context: transition.context,
    relationships: transition.relationships,
    captaincy: transition.captaincy,
    captaincySeasons: transition.captaincySeasons,
    tags: transition.tags,
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'LOANED',
        refId: loanContract.id,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * T-3-001 D-45, T-3-003 §4: ACCEPT_OFFER v2 — rng 없음, kind별 원자 전환. `pending.kind`가 `OFFERS`
 * 또는 `CONTRACT`(offers ≥ 1)일 때 받는다. Phase 1 첫 계약(`market.reason === 'FIRST_CONTRACT'`)은
 * 지금 코드 경로 그대로(회귀 금지). 공통: §1 만료 정리 후 이적 판정을 수행하고, 그 다음
 * `이적_희망`·`잔류_선언` 태그를 제거한다.
 */
function acceptOffer(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'ACCEPT_OFFER') {
    return fail('VALIDATION_FAILED', 'ACCEPT_OFFER 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 ACCEPT_OFFER를 받을 수 없다.`,
      {
        reason: 'NOT_ACTIVE',
      },
    );
  }
  const pending = state.pending;
  if (pending === null || (pending.kind !== 'OFFERS' && pending.kind !== 'CONTRACT')) {
    return fail('VALIDATION_FAILED', '결정 대기 중인 제안이 없다.', {
      reason: 'NO_PENDING_OFFERS',
    });
  }
  if (state.player.profile === null) {
    throw new RangeError('acceptOffer: ACTIVE 상태인데 player.profile이 null이다.');
  }

  const ruleset = input.ruleset;
  const nextRevision = snapshot.revision + 1;
  const { kept, timelineAdds } = prepareMarketOffers(
    pending,
    nextRevision,
    state.age,
    state.currentStep,
  );
  const lookup = lookupKeptOffer(pending.offers, kept, command.payload.offerId);
  if (!lookup.ok) {
    return fail(
      'VALIDATION_FAILED',
      lookup.reason === 'OFFER_NOT_FOUND' ? '제안 목록에 없는 offerId다.' : '대상 제안이 만료됐다.',
      {
        reason: lookup.reason,
      },
    );
  }
  const offer = lookup.offer;

  const baseState: CareerState = {
    ...state,
    tags: stripMarketDeclarationTags(state.tags),
    timeline: [...state.timeline, ...timelineAdds],
  };
  // TRANSFER/FREE_AGENT의 라이벌·배신 판정은 원본 `잔류_선언`을 사용한 뒤에 선언 태그를 제거한다.
  const stateWithExpiry: CareerState = { ...state, timeline: [...state.timeline, ...timelineAdds] };

  if (pending.market.reason === 'FIRST_CONTRACT') {
    return acceptFirstContractOffer(baseState, ruleset, offer, nextRevision);
  }
  if (pending.market.reason === 'INTEREST' && offer.id === pending.market.safeOfferId) {
    const nextState = buildStayState(baseState, nextRevision);
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
      appliedEffects: [],
      nextAction: 'ADVANCE',
    };
  }

  const contract = state.contract;
  if (contract === null) {
    throw new RangeError('acceptOffer: FIRST_CONTRACT이 아닌데 contract가 null이다.');
  }

  if (offer.kind === 'RENEWAL') {
    return acceptRenewalOffer(baseState, offer, nextRevision);
  }
  if (offer.kind === 'LOAN') {
    return acceptLoanOffer(stateWithExpiry, ruleset, contract, offer, nextRevision);
  }
  return acceptNewClubOffer(stateWithExpiry, ruleset, contract, offer, nextRevision);
}

/**
 * T-3-003 §6(D-46): 임대 원소속 계약 복원 — `parentContract`(suspended: true)를 `contract`
 * (suspended: false)로 되돌리고 `parentContract`를 null로, 임대 stint를 `'RETURNED'`로 마감한 뒤
 * 원소속 stint를 새로 연다. 관계·context 복원은 아래 `restoreParentClubState`가 명시적 RETURN과
 * 결산 중 자동 FA 분기에서 함께 적용한다.
 */
function restoreParentContractAndStint(state: CareerState, nextRevision: number): CareerState {
  const parent = state.parentContract;
  if (parent === null) {
    throw new RangeError('restoreParentContractAndStint: parentContract가 null이다.');
  }
  const restoredContract: Contract = { ...parent, suspended: false };
  const signedSeasonIndex = state.seasonHistory.length + 1;
  const closedHistory = closeOpenStint(state.clubHistory, state.seasonHistory.length, 'RETURNED');
  const newStint: ClubStint = {
    teamId: restoredContract.teamId,
    teamName: restoredContract.teamName,
    leagueTier: restoredContract.leagueTier,
    kind: 'PERMANENT',
    fromSeasonIndex: signedSeasonIndex,
    toSeasonIndex: null,
    endReason: null,
    contractId: restoredContract.id,
  };
  return {
    ...state,
    contract: restoredContract,
    parentContract: null,
    nextManager: null,
    clubHistory: [...closedHistory, newStint],
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'LOAN_RETURNED',
        refId: 'RETURN',
        age: state.age,
        step: state.currentStep,
      },
    ],
  };
}

/**
 * D-46 원소속 복귀의 공통 context·관계 규칙. 임대 구단에서의 전술 적합도·역할·감독 신뢰·주장·라이벌은
 * 버리고, 원소속 계약 기준으로 재설정한다. positionProficiency는 명시적 RETURN과 동일하게 원래
 * 포지션 계획이면 현재 값을 유지하고, 아니면 룰셋의 강제값을 쓴다.
 */
function restoreParentClubState(state: CareerState, ruleset: Ruleset): CareerState {
  const parent = state.contract;
  const profile = state.player.profile;
  if (parent === null || profile === null) {
    throw new RangeError('restoreParentClubState: 복원된 contract·player.profile이 null이다.');
  }
  const carryRules = ruleset.transferRules.relationshipCarry;
  const positionProficiency =
    parent.positionPlan === profile.primaryPosition
      ? state.context.positionProficiency
      : ruleset.contractRules.imposedPositionProficiency;
  return {
    ...state,
    captaincy: 'NONE',
    captaincySeasons: 0,
    context: {
      tacticalFit: ruleset.offerRules.tacticalFitEstimate.min,
      squadStatus: ruleset.contractRules.squadStatusByRole[parent.rolePromise],
      positionProficiency,
    },
    relationships: {
      ...state.relationships,
      managerTrust: carryRules.newManagerTrustBase,
      captain: 0,
      rival: 0,
      fans: Math.floor((state.relationships.fans * carryRules.fansCarryBp) / 10000),
    },
  };
}

/**
 * T-3-003 §6(D-46): 결산 뒤 `contract.kind === 'LOAN'`이면 `settleSeason`이 이 함수로 넘긴다. 원소속
 * 잔여 시즌이 0이면 복귀 대신 FA로 곧장 EXPIRED 시장을 연다. 아니면 `LOAN_RETURN` pending을 연다
 * (`RETURN` + 매입 옵션이 되면 `PERMANENT`). rng는 `parentRemaining === 0`일 때만(재사용하는 시장
 * 생성기가) 소비한다 — LOAN_RETURN 명령 처리기 자체는 소비하지 않는다.
 */
function settleLoanSeason(
  state: CareerState,
  ruleset: Ruleset,
  result: SeasonResult,
  nextRevision: number,
): CareerState {
  const loanContract = state.contract;
  if (loanContract === null || loanContract.kind !== 'LOAN') {
    throw new RangeError('settleLoanSeason: contract가 LOAN이 아니다.');
  }
  const parent = state.parentContract;
  if (parent === null) {
    throw new RangeError('settleLoanSeason: parentContract가 null이다.');
  }

  const parentRemaining = computeContractSeasonsRemaining(
    parent.lengthSeasons,
    parent.signedAtRevision,
    state.timeline,
  );

  if (parentRemaining === 0) {
    const restored = restoreParentClubState(
      restoreParentContractAndStint(state, nextRevision),
      ruleset,
    );
    const generated = generateMarket({
      state: restored,
      ruleset,
      reason: 'EXPIRED',
      revision: nextRevision,
      rng: restored.rngState,
    });
    return { ...restored, rngState: generated.rngState, pending: generated.pending };
  }

  const possibleMinutes = result.selectionSummary.possibleMinutes;
  const shareBp =
    possibleMinutes === 0
      ? 0
      : Math.floor((result.selectionSummary.minutes * 10000) / possibleMinutes);
  const buyOptionMinor = loanContract.loan === null ? null : loanContract.loan.buyOptionMinor;
  const canBuy = buyOptionMinor !== null && shareBp >= ruleset.transferRules.loan.buyMinShareBp;

  return {
    ...state,
    pending: {
      kind: 'LOAN_RETURN',
      options: canBuy ? ['RETURN', 'PERMANENT'] : ['RETURN'],
      buyOptionMinor,
    },
  };
}

/**
 * T-3-003 §6(D-46): `LOAN_RETURN` — rng 없음. `RETURN`은 원소속 복귀(관계·context 재설정 포함),
 * `PERMANENT`(옵션에 있을 때만)는 임대 구단과 새 PERMANENT 계약을 맺는다.
 */
function loanReturn(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'LOAN_RETURN') {
    return fail('VALIDATION_FAILED', 'LOAN_RETURN 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 LOAN_RETURN을 받을 수 없다.`,
      { reason: 'NOT_ACTIVE' },
    );
  }
  const pending = state.pending;
  if (pending === null || pending.kind !== 'LOAN_RETURN') {
    return fail('VALIDATION_FAILED', '결정 대기 중인 임대 복귀 결정이 없다.', {
      reason: 'NO_PENDING_LOAN_RETURN',
    });
  }
  const decision = command.payload.decision;
  if (!pending.options.includes(decision)) {
    return fail('VALIDATION_FAILED', `이 결정(${decision})은 선택할 수 없다.`, {
      reason: 'OPTION_NOT_AVAILABLE',
    });
  }
  if (state.player.profile === null) {
    throw new RangeError('loanReturn: ACTIVE 상태인데 player.profile이 null이다.');
  }
  const profile = state.player.profile;

  const nextRevision = snapshot.revision + 1;
  const ruleset = input.ruleset;

  if (decision === 'RETURN') {
    const restored = restoreParentClubState(
      restoreParentContractAndStint(state, nextRevision),
      ruleset,
    );
    const parent = restored.contract;
    if (parent === null) {
      throw new RangeError('loanReturn: 복원 뒤 contract가 null이다.');
    }
    const nextState: CareerState = {
      ...restored,
      pending: null,
    };
    return {
      ok: true,
      snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
      appliedEffects: [],
      nextAction: 'ADVANCE',
    };
  }

  // decision === 'PERMANENT'
  const loanContract = state.contract;
  if (loanContract === null || loanContract.kind !== 'LOAN') {
    throw new RangeError('loanReturn: PERMANENT인데 contract가 LOAN이 아니다.');
  }
  const lastSeason = state.seasonHistory.at(-1);
  if (lastSeason === undefined) {
    throw new RangeError('loanReturn: seasonHistory가 비어 있다.');
  }

  const team = findTeam(ruleset, loanContract.teamId);
  const band = findOvrBand(ruleset.contractRules, profile.baseOvr);
  const wage = lookupBandAmount(
    ruleset.contractRules.wageBands,
    team.wageBandId,
    band.id,
    'wageBands',
  );
  const signingBonus = lookupBandAmount(
    ruleset.contractRules.signingBonus,
    team.wageBandId,
    band.id,
    'signingBonus',
  );
  const rolePromise = lastSeason.result.selectionSummary.squadRoleAtEnd;
  const signedSeasonIndex = state.seasonHistory.length + 1;

  const newContract: Contract = {
    id: `CTR-${nextRevision}`,
    offerId: loanContract.offerId,
    teamId: loanContract.teamId,
    teamName: loanContract.teamName,
    leagueTier: loanContract.leagueTier,
    lengthSeasons: ruleset.transferRules.renewal.lengthSeasons,
    wageMinorPerWeek: wage,
    signingBonusMinor: signingBonus,
    rolePromise,
    shirtNumber: loanContract.shirtNumber,
    signatureType: 'AUTO',
    signedAtRevision: nextRevision,
    kind: 'PERMANENT',
    appearancePromise: { minutesShareBp: ruleset.contractRules.promiseMinutesShareBp[rolePromise] },
    positionPlan: loanContract.positionPlan,
    suspended: false,
    loan: null,
    promiseBreaches: 0,
    signedSeasonIndex,
  };

  const closedHistory = closeOpenStint(
    state.clubHistory,
    state.seasonHistory.length,
    'TRANSFERRED',
  );
  const newStint: ClubStint = {
    teamId: loanContract.teamId,
    teamName: loanContract.teamName,
    leagueTier: loanContract.leagueTier,
    kind: 'PERMANENT',
    fromSeasonIndex: signedSeasonIndex,
    toSeasonIndex: null,
    endReason: null,
    contractId: newContract.id,
  };

  const nextState: CareerState = {
    ...state,
    contract: newContract,
    parentContract: null,
    // PERMANENT는 실제 teamId가 같은 임대 구단 잔류이므로 결산에서 예약한 감독 교체와
    // 해당 구단의 주장단 상태·누적을 다음 START_SEASON까지 보존한다. RETURN 분기는 위의
    // restoreParentClubState에서 원소속 기준으로 명시적으로 초기화한다.
    nextManager: state.nextManager,
    captaincy: state.captaincy,
    captaincySeasons: state.captaincySeasons,
    clubHistory: [...closedHistory, newStint],
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'LOAN_RETURNED',
        refId: 'PERMANENT',
        age: state.age,
        step: state.currentStep,
      },
      {
        revision: nextRevision,
        kind: 'TRANSFERRED',
        refId: newContract.id,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'CONTRACT_CONFIRMED'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * T-2-001 D-25 CMD-SIM-003, T-2-005 D-39 확장, T-2-014 D-40/D-42 확장. `season.currentStep === 12`이고
 * SETTLEMENT pending이 열려 있을 때만 유효하다. 순서(브리프 settlement.ts 절 + D-40 "만료 → 회귀"):
 * 시즌 만료(`expireAtSeasonEnd`) → 결산 전 값 기록 → 성장(`computeGrowth`) → 경계 회귀
 * (`seasonBoundaryReset` — form·fitness·morale 리셋 + `appliedSourceIds`의 `season:` 접두 항목 정리) →
 * after 값 기록 → `SeasonResult` 조립·해시 → `seasonHistory`에 `{ …, result }`로 남긴다 → 태그 평가
 * (`evaluateCareerTags`)·부여(`grantCareerTag`).
 */
function settleSeason(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'SETTLE_SEASON') {
    return fail('VALIDATION_FAILED', 'SETTLE_SEASON 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  const season = state.season;
  if (
    season === null ||
    season.currentStep !== 12 ||
    state.pending === null ||
    state.pending.kind !== 'SETTLEMENT'
  ) {
    return fail('VALIDATION_FAILED', '시즌을 결산할 수 없다.', { reason: 'SEASON_NOT_SETTLEABLE' });
  }
  const profile = state.player.profile;
  if (profile === null) {
    throw new RangeError('settleSeason: season이 있는데 player.profile이 null이다.');
  }

  const nextRevision = snapshot.revision + 1;
  const nextAge = state.age + 1;
  const reset = input.ruleset.seasonBoundaryReset;

  // D-40 규칙 3·4: 결산 직전 만료(AT_SEASON_END·이번 시즌 AT_SEASON_INDEX·자연 만료 못한 AT_STEP)를
  // 먼저 되돌린 뒤 나머지 결산 절차를 이 상태 위에서 진행한다.
  const expiredState = expireAtSeasonEnd(state, season.index);

  const growth = computeGrowth(
    {
      age: expiredState.age,
      attributes: expiredState.attributes,
      archetypeId: profile.archetypeId,
      truePotential: profile.truePotential,
      baseOvrBefore: profile.baseOvr,
      minutes: season.playerStats.minutes,
      ratedMatches: season.playerStats.ratedMatches,
      ratingSumTenths: season.playerStats.ratingSumTenths,
      trainingFocus: season.trainingFocus,
      growthCarryCenti: expiredState.growthCarryCenti,
    },
    input.ruleset,
  );

  const stateDeltas: SeasonResult['stateDeltas'] = {
    form: { before: expiredState.state.form, after: reset.form },
    fitness: { before: expiredState.state.fitness, after: reset.fitness },
    morale: { before: expiredState.state.morale, after: reset.morale },
    managerTrust: {
      before: expiredState.relationships.managerTrust,
      after: expiredState.relationships.managerTrust,
    },
  };

  const resultWithoutHash = buildSeasonResult({
    state: expiredState,
    ruleset: input.ruleset,
    attributeDeltas: growth.attributeDeltas,
    baseOvr: growth.baseOvr,
    stateDeltas,
  });
  const result: SeasonResult = { ...resultWithoutHash, hash: hashSeasonResult(resultWithoutHash) };

  const summary: SeasonSummary = {
    index: season.index,
    simulationMode: season.simulationMode,
    teamId: season.teamId,
    competitions: season.competitions,
    settledAtRevision: nextRevision,
    result,
  };

  // D-40 규칙 2: 시즌 경계 회귀가 `appliedSourceIds`의 `season:` 접두 항목(ONCE_PER_SEASON 중복 검사
  // 키)을 지운다 — 다음 시즌에 같은 sourceId가 다시 적용될 수 있어야 한다.
  const clearedAppliedSourceIds = expiredState.appliedSourceIds.filter(
    (id) => !id.startsWith('season:'),
  );

  const settledState: CareerState = {
    ...expiredState,
    age: nextAge,
    attributes: growth.attributes,
    growthCarryCenti: growth.growthCarryCenti,
    appliedSourceIds: clearedAppliedSourceIds,
    player: { ...expiredState.player, profile: { ...profile, baseOvr: growth.baseOvr.after } },
    season: null,
    seasonHistory: [...expiredState.seasonHistory, summary],
    state: { form: reset.form, fitness: reset.fitness, morale: reset.morale },
    pending: null,
    timeline: [
      ...expiredState.timeline,
      { revision: nextRevision, kind: 'SEASON_SETTLED', refId: null, age: nextAge, step: 12 },
    ],
  };

  // T-4-001 D-50: onSettlementRelations 훅(지금은 항등)은 settledState를 만든 직후, evaluateCareerTags
  // 전에 부른다 — 감독 교체·주장 임명·평판 갱신은 T-4-003이 이 자리를 채운다.
  const relationsResult = onSettlementRelations({
    state: settledState,
    season,
    result,
    ruleset: input.ruleset,
    rng: settledState.rngState,
    timelineRevision: nextRevision,
  });
  const stateAfterRelations: CareerState = {
    ...relationsResult.state,
    rngState: relationsResult.rng,
  };

  // D-42: `seasonHistory`에 이번 시즌 result가 들어간 뒤에 평가한다(커리어 누적 챕터 집계가 이번
  // 시즌 몫까지 포함하도록).
  const grantedTagIds = evaluateCareerTags(stateAfterRelations, result, input.ruleset);
  const nextState = grantedTagIds.reduce((acc, tagId) => {
    const granted = grantCareerTag(acc, tagId, {
      seasonIndex: season.index,
      revision: nextRevision,
      refId: `SETTLE_SEASON:${season.index}`,
    });
    return {
      ...granted,
      timeline: [
        ...granted.timeline,
        {
          revision: nextRevision,
          kind: 'CAREER_TAG_GRANTED' as const,
          refId: tagId,
          age: nextAge,
          step: 12,
        },
      ],
    };
  }, stateAfterRelations);

  // T-3-003 D-47/D-46/D-43: 태그 부여 뒤 순서대로 — (a) 약속 위반 판정 → (b) 임대면 LOAN_RETURN 분기
  // → (c) 아니면 결산 뒤 시장 개방.
  const contractForPromise = nextState.contract;
  if (contractForPromise === null) {
    throw new RangeError('settleSeason: 결산 뒤 contract가 null이다.');
  }
  const carryRules = input.ruleset.transferRules.relationshipCarry;
  const promiseBreachState: CareerState = result.promiseFulfilment.fulfilled
    ? { ...nextState, tags: sortUniqueTags(nextState.tags.filter((tag) => tag !== '약속_위반')) }
    : (() => {
        const breachEffect: Effect = {
          kind: 'RELATION',
          target: 'managerTrust',
          delta: carryRules.managerTrustPromiseBreach,
          clamp: { min: 0, max: 100 },
          appliesAt: { kind: 'IMMEDIATE' },
          expiresAt: null,
          stackingRule: 'SUM',
          sourceId: `SETTLE_SEASON:${season.index}:PROMISE_BREACH`,
          reasonTag: 'PROMISE_BREACH',
        };
        const applied = applyEffects(
          nextState,
          [breachEffect],
          { step: 12 },
          input.ruleset.relationshipRules,
        ).state;
        return {
          ...applied,
          contract: {
            ...contractForPromise,
            promiseBreaches: contractForPromise.promiseBreaches + 1,
          },
          tags: sortUniqueTags([...applied.tags, '약속_위반']),
        };
      })();

  const finalState =
    promiseBreachState.contract !== null && promiseBreachState.contract.kind === 'LOAN'
      ? settleLoanSeason(promiseBreachState, input.ruleset, result, nextRevision)
      : openMarketAfterSettlement(promiseBreachState, input.ruleset, nextRevision).state;

  return {
    ok: true,
    snapshot: buildSnapshot(finalState, nextRevision, 'SEASON_SETTLED'),
    appliedEffects: [],
    // 결산 다음은 새 시즌을 열지 말지 결정하는 화면(START_SEASON, SCR-005)이거나 시장·임대 복귀
    // 결정이라 'ADVANCE'가 아니라 'DECISION'이다 — season이 null인 채로 'ADVANCE'를 보내면 seasonPhase가
    // SETTLEMENT로 남아 NOTHING_TO_ADVANCE로 실패한다.
    nextAction: 'DECISION',
    seasonResult: result,
  };
}

/**
 * T-2-002 D-34 CMD-SIM-004: ROLE_PROPOSAL pending을 ACCEPT/DECLINE으로 닫는다. DECLINE·KEEP·
 * POSITION_CHANGE·ROLE_CHANGE 네 분기 모두 managerTrust(그리고 POSITION_CHANGE는 `primaryPosition`·
 * `context.tacticalFit`·`context.positionProficiency`를 제안이 들고 있던 값 — tacticalFitAfter·
 * proficiencyAfter, roll 없음 불변식 유지, 재계산하지 않는다 —, ROLE_CHANGE는 `context.squadStatus`를
 * 제안된 새 역할(`proposal.to`) 기준으로)만 먼저 갱신한 뒤, **네 분기 공통으로** `season.selection`을
 * `rankPositionForPlayer`(갱신된 position·tacticalFit·managerTrust·squadStatus·familiarity·
 * form/fitness/morale·competitors)로 다시 산출하고 `season.squadRole`을 그 결과에서
 * `squadRoleFromSelection`으로 유도한다(D-26). DECLINE(-8)·KEEP(+2)도 managerTrust가 바뀌어 선발
 * 점수 입력이 달라지므로 재산출이 필요하다. `proposal.squadRoleAfter`/`proposal.to`는 "제안 계산
 * 시점의 예측값"일 뿐이고, 실제 `season.squadRole`은 이 재산출된 순위가 정한다 — 제안값을 그대로
 * squadRole에 옮기면 이 함수가 방금 반영한 managerTrust·squadStatus 변화가 selection 점수에 반영되면서
 * squadRole과 selection이 서로 어긋날 수 있다. `contract.rolePromise`(계약 조건)는 브리프 명시대로
 * ROLE_CHANGE에서도 바꾸지 않는다(계약은 Phase 3).
 */
function resolveRole(input: SimulationInput, snapshot: DomainSnapshot): SimulationResult {
  const command = input.command;
  if (command.type !== 'RESOLVE_ROLE') {
    return fail('VALIDATION_FAILED', 'RESOLVE_ROLE 처리기에 다른 명령이 전달되었다.');
  }
  const state = snapshot.state;
  if (state.status !== 'ACTIVE') {
    return fail(
      'VALIDATION_FAILED',
      `status가 ${state.status}일 때는 RESOLVE_ROLE을 받을 수 없다.`,
      {
        reason: 'NOT_ACTIVE',
      },
    );
  }
  const pending = state.pending;
  if (pending === null || pending.kind !== 'ROLE_PROPOSAL') {
    return fail('VALIDATION_FAILED', '결정 대기 중인 역할 제안이 없다.', {
      reason: 'NO_ROLE_PROPOSAL',
    });
  }
  if (state.season === null || state.player.profile === null || state.contract === null) {
    throw new RangeError(
      'resolveRole: ROLE_PROPOSAL pending인데 season·player.profile·contract 중 null이 있다.',
    );
  }

  const proposal = pending.proposal;
  const rules = input.ruleset.selectionRules;
  const nextRevision = snapshot.revision + 1;
  const season = state.season;
  const decision = command.payload.decision;

  let managerTrust = state.relationships.managerTrust;
  let context = state.context;
  let profile = state.player.profile;

  if (decision === 'DECLINE') {
    managerTrust = clamp(managerTrust + rules.roleProposal.declineTrustDelta, 0, 100);
  } else if (proposal.type === 'KEEP') {
    managerTrust = clamp(managerTrust + rules.roleProposal.keepConfirmTrustDelta, 0, 100);
  } else if (proposal.type === 'POSITION_CHANGE') {
    managerTrust = clamp(managerTrust + rules.roleProposal.acceptTrustDelta, 0, 100);
    profile = { ...profile, primaryPosition: proposal.to };
    context = {
      ...context,
      tacticalFit: proposal.tacticalFitAfter,
      positionProficiency: proposal.proficiencyAfter,
    };
  } else {
    // proposal.type === 'ROLE_CHANGE'
    managerTrust = clamp(managerTrust + rules.roleProposal.acceptTrustDelta, 0, 100);
    context = {
      ...context,
      squadStatus: computeSquadStatus(
        { rolePromise: proposal.to, captaincy: 'NONE', lastRating: null },
        rules,
        input.ruleset.contractRules.squadStatusByRole,
      ),
    };
  }

  const ranking = rankPositionForPlayer({
    ruleset: input.ruleset,
    styleId: season.styleId,
    position: profile.primaryPosition,
    playerName: profile.name,
    baseOvr: profile.baseOvr,
    tacticalFit: context.tacticalFit,
    managerTrust,
    form: state.state.form,
    fitness: state.state.fitness,
    morale: state.state.morale,
    familiarity: familiarityOf(context.positionProficiency, rules),
    squadStatus: context.squadStatus,
    competitors: season.squad.competitors,
  });
  const nextSeason: FootballSeason = {
    ...season,
    squadRole: squadRoleFromSelection(ranking),
    selection: ranking,
  };

  const nextState: CareerState = {
    ...state,
    season: nextSeason,
    context,
    player: { ...state.player, profile },
    relationships: { ...state.relationships, managerTrust },
    pending: null,
    timeline: [
      ...state.timeline,
      {
        revision: nextRevision,
        kind: 'ROLE_RESOLVED',
        // T-2-005 D-39: `${type}:${decision}` 형식(브리프 "roleChanges: 이 시즌 timeline의
        // ROLE_RESOLVED 항목에서 type(refId)·decision을 뽑는다" — settlement.ts가 이 형식을 파싱한다).
        // 기존 골든의 refId가 `proposal.type`뿐이던 형식에서 바뀐다(재기록 사유).
        refId: `${proposal.type}:${decision}`,
        age: state.age,
        step: state.currentStep,
      },
    ],
  };

  return {
    ok: true,
    snapshot: buildSnapshot(nextState, nextRevision, 'STEP_BOUNDARY'),
    appliedEffects: [],
    nextAction: 'ADVANCE',
  };
}

/**
 * CREATE_CAREER → UPDATE_PLAYER_DRAFT → CONFIRM_PLAYER → ADVANCE → RESOLVE_EVENT → RESOLVE_CHAPTER →
 * ACCEPT_OFFER → RESOLVE_ROLE 명령을 처리하는 순수 함수. throw하지 않는다: 도메인 오류는 항상
 * `{ ok: false }`로 돌아온다.
 */
export function simulate(input: SimulationInput): SimulationResult {
  if (input.ruleset.version !== input.rulesetVersion) {
    return fail('VERSION_MISMATCH', '룰셋 버전이 SimulationInput.rulesetVersion과 다르다.');
  }

  const command = input.command;
  if (command.type === 'CREATE_CAREER') {
    return createCareer(input);
  }

  const snapshot = input.snapshot;
  if (snapshot === null) {
    return fail('VALIDATION_FAILED', 'CREATE_CAREER가 아닌 명령은 snapshot이 필요하다.');
  }
  if (command.expectedRevision !== snapshot.revision) {
    return fail('CAREER_REVISION_CONFLICT', 'expectedRevision이 snapshot revision과 다르다.', {
      serverRevision: snapshot.revision,
      expectedRevision: command.expectedRevision,
    });
  }
  if (
    input.rulesetVersion !== snapshot.rulesetVersion ||
    input.contentPackVersion !== snapshot.contentPackVersion
  ) {
    return fail('VERSION_MISMATCH', 'SimulationInput의 버전이 snapshot과 다르다.');
  }

  switch (command.type) {
    case 'UPDATE_PLAYER_DRAFT':
      return updatePlayerDraft(input, snapshot);
    case 'CONFIRM_PLAYER':
      return confirmPlayer(input, snapshot);
    case 'START_SEASON':
      return startSeason(input, snapshot);
    case 'ADVANCE':
      return advance(input, snapshot);
    case 'SETTLE_SEASON':
      return settleSeason(input, snapshot);
    case 'RESOLVE_EVENT':
      return resolveEvent(input, snapshot);
    case 'RESOLVE_CHAPTER':
      return resolveChapterCommand(input, snapshot);
    case 'ACCEPT_OFFER':
      return acceptOffer(input, snapshot);
    case 'RESOLVE_ROLE':
      return resolveRole(input, snapshot);
    case 'NEGOTIATE':
      return negotiateOffer(input, snapshot);
    case 'REJECT_OFFER':
      return rejectOffer(input, snapshot);
    case 'LOAN_RETURN':
      return loanReturn(input, snapshot);
  }
}

function isSorted(values: readonly string[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (compareCodePoints(values[i - 1] as string, values[i] as string) > 0) return false;
  }
  return true;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * stateHash 일치, 버전 일치, 배열 정렬 불변, 타임라인 revision 비감소, pending·status 정합,
 * contract·pending(OFFERS) 정합을 검사한다. 계약 중에도 pending이 EVENT인 것은 유효하다
 * (Phase 2부터 시즌 중 이벤트가 계약된 선수에게도 걸린다). contract와 pending(OFFERS)이 함께 있어도
 * market.reason이 FIRST_CONTRACT가 아니면 유효하다(T-3-003 §5: `openMarketAfterSettlement`가 여는
 * EXPIRED·INTEREST 시장은 계약이 아직 만료 처리되지 않은 채로 pending만 연다 — 응답 전까지 contract가
 * 남아 있는 것이 정상이다). 첫 계약(FIRST_CONTRACT) 경로만 계약이 없어야 하는 불변이 유효하다.
 * T-2-001: ADVANCE 한 번이 여러 step을 지나갈 수 있어(RULE-TIME-002) 같은 revision에 STEP_PASSED
 * 항목이 여럿 남을 수 있으므로 "단조 증가"가 아니라 "비감소"만 요구한다.
 */
export function verifySnapshot(
  snapshot: DomainSnapshot,
): { ok: true } | { ok: false; reason: string } {
  if (hashState(snapshot.state) !== snapshot.stateHash) {
    return { ok: false, reason: 'STATE_HASH_MISMATCH' };
  }
  if (
    snapshot.rulesetVersion !== snapshot.state.rulesetVersion ||
    snapshot.contentPackVersion !== snapshot.state.contentPackVersion
  ) {
    return { ok: false, reason: 'VERSION_MISMATCH' };
  }
  if (!isSorted(snapshot.state.tags) || hasDuplicates(snapshot.state.tags)) {
    return { ok: false, reason: 'TAGS_NOT_SORTED_OR_DUPLICATED' };
  }
  if (!isSorted(snapshot.state.appliedSourceIds)) {
    return { ok: false, reason: 'APPLIED_SOURCE_IDS_NOT_SORTED' };
  }

  const timeline = snapshot.state.timeline;
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i]!.revision < timeline[i - 1]!.revision) {
      return { ok: false, reason: 'TIMELINE_NOT_MONOTONIC' };
    }
  }

  if (snapshot.state.status !== 'ACTIVE' && snapshot.state.pending !== null) {
    return { ok: false, reason: 'PENDING_STATUS_MISMATCH' };
  }
  if (
    snapshot.state.contract !== null &&
    snapshot.state.pending?.kind === 'OFFERS' &&
    snapshot.state.pending.market.reason === 'FIRST_CONTRACT'
  ) {
    return { ok: false, reason: 'CONTRACT_OFFERS_CONFLICT' };
  }

  return { ok: true };
}
