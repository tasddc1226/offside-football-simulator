import { selectChapter, type ChapterCandidateInput, type ChapterOpenResult } from './chapter.js';
import { buildRenewalOffer, isRenewalWindowOpen, isYouthExitRequired } from './market.js';
import { computeContractSeasonsRemaining } from './market-value.js';
import {
  applyNationalTeamCallUp,
  buildNationalTeamCallUpRecord,
  qualifyNationalTeam,
} from './national-team.js';
import { rollRange } from './roll-range.js';
import type { RngState } from './rng.js';
import type { League, LeagueCalendar, LeagueCalendarSlot, Ruleset } from './ruleset.js';
import { computeRoleProposal, type RoleProposalContext } from './selection.js';
import type {
  CareerState,
  CompetitionRecord,
  DecisionSlot,
  MarketSummary,
  MatchRecord,
  NationalTeamCallUpRecord,
  Pending,
  SeasonStep,
  SimulationMode,
  StepMatchResult,
  TimelineEntry,
} from './types.js';

/** RULE-TIME-004: 시즌당 핵심 경기 챕터 상한(모드 공통). */
const CHAPTER_BUDGET_CAP = 4;

/** RULE-TIME-004: 시즌당 결정 수 상한(모드별). */
function totalBudgetCap(mode: SimulationMode): number {
  return mode === 'FAST' ? 6 : 10;
}

type SlotLocation = { stepIndex: number; slotIndex: number; slot: DecisionSlot };

function collectCuttable(
  steps: SeasonStep[],
  predicate: (slot: DecisionSlot) => boolean,
): SlotLocation[] {
  const found: SlotLocation[] = [];
  for (const step of steps) {
    step.decisionSlots.forEach((slot, slotIndex) => {
      if (!slot.required && !slot.skippedByBudget && predicate(slot)) {
        found.push({ stepIndex: step.index, slotIndex, slot });
      }
    });
  }
  return found;
}

/**
 * RULE-TIME-004 절단 순서: step 오름차순 뒤쪽부터(= step 내림차순으로 자른다), 같은 step이면
 * importance MINOR가 먼저 잘린다. Array.prototype.sort는 ES2019부터 stable이므로 나머지
 * 동률은 원래 배열 순서(step 안 slot index 오름차순)로 결정된다.
 */
function orderForCut(candidates: SlotLocation[]): SlotLocation[] {
  return [...candidates].sort((a, b) => {
    if (a.stepIndex !== b.stepIndex) return b.stepIndex - a.stepIndex;
    const aMinorFirst = a.slot.importance === 'MINOR' ? 0 : 1;
    const bMinorFirst = b.slot.importance === 'MINOR' ? 0 : 1;
    return aMinorFirst - bMinorFirst;
  });
}

function applyCut(steps: SeasonStep[], toCut: readonly SlotLocation[]): SeasonStep[] {
  if (toCut.length === 0) return steps;
  const cutSet = new Set(toCut.map((location) => `${location.stepIndex}:${location.slotIndex}`));
  return steps.map((step) => ({
    ...step,
    decisionSlots: step.decisionSlots.map((slot, slotIndex) =>
      cutSet.has(`${step.index}:${slotIndex}`) ? { ...slot, skippedByBudget: true } : slot,
    ),
  }));
}

function buildSlot(calendarSlot: LeagueCalendarSlot): DecisionSlot {
  return calendarSlot.importance === undefined
    ? { kind: calendarSlot.kind, required: calendarSlot.required }
    : { kind: calendarSlot.kind, required: calendarSlot.required, importance: calendarSlot.importance };
}

/**
 * 룰셋 `leagueCalendar`에서 시즌 `steps`를 만들고 RULE-TIME-004 결정 예산을 적용한다. 챕터 상한(4)을
 * 먼저 자르고, 남은 선택 슬롯에 모드별 총 상한(FAST 6·CHAPTER 10)을 적용한다. 두 절단 모두 같은
 * 결정론적 순서(step 내림차순, 같은 step이면 MINOR 먼저)를 쓴다. 예산은 "그 모드가 실제로 여는
 * 결정"에만 적용된다(RULE-TIME-004) — FAST가 애초에 열지 않는 슬롯(EVENT·MINOR 챕터, RULE-TIME-003)은
 * 후보에서 빠진다. 이 필터가 없으면 FAST 예산(6)이 모드와 무관한 슬롯 수까지 세어, FAST가 실제로
 * 여는 MAJOR 챕터·CONTRACT 같은 슬롯이 예산 초과로 잘못 잘린다.
 */
export function buildSeasonSteps(calendar: LeagueCalendar, mode: SimulationMode): SeasonStep[] {
  let steps: SeasonStep[] = calendar.steps.map((calendarStep) => ({
    index: calendarStep.index,
    phase: calendarStep.phase,
    windowOpen: calendarStep.windowOpen,
    decisionSlots: calendarStep.slots.map(buildSlot),
    summary: null,
  }));

  const isBudgetedInMode = (slot: DecisionSlot): boolean => mode === 'CHAPTER' || isOpenableInFastMode(slot);

  const chapterCandidates = collectCuttable(steps, (slot) => slot.kind === 'CHAPTER' && isBudgetedInMode(slot));
  if (chapterCandidates.length > CHAPTER_BUDGET_CAP) {
    const excess = chapterCandidates.length - CHAPTER_BUDGET_CAP;
    steps = applyCut(steps, orderForCut(chapterCandidates).slice(0, excess));
  }

  const cap = totalBudgetCap(mode);
  const optionalCandidates = collectCuttable(steps, isBudgetedInMode);
  if (optionalCandidates.length > cap) {
    const excess = optionalCandidates.length - cap;
    steps = applyCut(steps, orderForCut(optionalCandidates).slice(0, excess));
  }

  return steps;
}

export function buildInitialCompetitions(calendar: LeagueCalendar): CompetitionRecord[] {
  const firstCupRound = calendar.cupRounds[0];
  return [
    {
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      position: null,
      cupRound: null,
    },
    {
      competitionId: 'CUP',
      kind: 'CUP',
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      position: null,
      cupRound: firstCupRound === undefined ? null : firstCupRound.round,
    },
  ];
}

/** RULE-TIME-003: FAST가 여는 슬롯(required, CONTRACT·INJURY·ROLE·NATIONAL_TEAM, MAJOR 챕터). */
function isOpenableInFastMode(slot: DecisionSlot): boolean {
  if (slot.required) return true;
  if (slot.kind === 'CONTRACT' || slot.kind === 'INJURY' || slot.kind === 'ROLE' || slot.kind === 'NATIONAL_TEAM') {
    return true;
  }
  if (slot.kind === 'CHAPTER' && slot.importance === 'MAJOR') return true;
  return false;
}

/** RULE-TIME-002 우선순위: 계약·부상·역할·대표팀(상태를 바꾸는 결정) → 선택 이벤트 → 챕터. */
function slotPriority(kind: DecisionSlot['kind']): number {
  switch (kind) {
    case 'CONTRACT':
    case 'INJURY':
    case 'ROLE':
    case 'NATIONAL_TEAM':
      return 0;
    case 'EVENT':
      return 1;
    case 'CHAPTER':
      return 2;
    case 'SETTLEMENT':
      return 3;
  }
}

export type EligibleEvent = { eventId: string; version: number; weight: number; slot?: 'TRANSFER_WINDOW' };

export type SlotOpenResult =
  | { opened: false; nationalTeamAutoDecline?: NationalTeamCallUpRecord }
  | { opened: true; pending: Pending; rngState: RngState; eventId?: string };

/**
 * 한 step의 decisionSlots 중 이번 ADVANCE에서 열 슬롯 하나를 고른다. 예산에 잘린 슬롯과 모드가
 * 거르는 슬롯은 후보에서 빠진다. EVENT는 eligibleEvents가 비어 있으면 건너뛴다(roll 없음, RULE-TIME-004
 * 문서 "eligibleEvents가 비어 있으면 그 슬롯은 건너뛴다"). ROLE은 `roleContext`로 `computeRoleProposal`을
 * 계산해 `ROLE_PROPOSAL` pending을 연다(roll을 소비하지 않는다 — D-34). T-2-004 D-38: CHAPTER는
 * `walkToNextDecision`이 미리 계산해 넘긴 `chapterOpen`(roll 없음, `selectChapter` 결과)이 null이면
 * 건너뛴다(이 step에 맞는 챕터 후보가 없었다는 뜻 — 일반 경기로 지나간다). CONTRACT·INJURY는 기존
 * 호환 형태를 열고, NATIONAL_TEAM은 자격 판정·부상 우선 규칙을 거친 뒤 연다.
 */
export function selectOpenSlot(
  step: SeasonStep,
  mode: SimulationMode,
  eligibleEvents: readonly EligibleEvent[],
  rngState: RngState,
  roleContext: RoleProposalContext | null,
  chapterOpen: ChapterOpenResult | null,
  // T-3-001 D-43: CONTRACT pending의 `market.openedAtRevision`·`seasonIndex`를 채우는 데만 쓴다
  // (roll을 소비하지 않는다).
  revision: number,
  seasonIndex: number,
  // T-3-002 D-43 (a): CONTRACT 분기가 `buildRenewalOffer`를 부르는 데만 쓴다(roll 없음).
  state: CareerState,
  ruleset: Ruleset,
  /** 이번 step 경기에서 새로 발생한 minor injury까지 포함한 대표팀 출전 불가 여부. */
  injuryUnavailable = false,
): SlotOpenResult {
  const candidates = step.decisionSlots
    .filter((slot) => !slot.skippedByBudget)
    .filter((slot) => mode === 'CHAPTER' || isOpenableInFastMode(slot))
    .slice()
    .sort((a, b) => slotPriority(a.kind) - slotPriority(b.kind));

  for (const slot of candidates) {
    if (slot.kind === 'EVENT') {
      const ordinaryEvents = eligibleEvents.filter((event) => event.slot === undefined);
      if (ordinaryEvents.length === 0) continue;
      let chosen = ordinaryEvents[0]!;
      let nextRngState = rngState;
      if (ordinaryEvents.length >= 2) {
        const weightSum = ordinaryEvents.reduce((sum, event) => sum + event.weight, 0);
        const rolled = rollRange(rngState, 1, weightSum);
        nextRngState = rolled.state;
        let cumulative = 0;
        for (const event of ordinaryEvents) {
          cumulative += event.weight;
          if (rolled.value <= cumulative) {
            chosen = event;
            break;
          }
        }
      }
      return {
        opened: true,
        pending: { kind: 'EVENT', eventId: chosen.eventId, version: chosen.version },
        rngState: nextRngState,
        eventId: chosen.eventId,
      };
    }

    if (slot.kind === 'SETTLEMENT') {
      return { opened: true, pending: { kind: 'SETTLEMENT', step: step.index }, rngState };
    }

    if (slot.kind === 'CHAPTER') {
      if (chapterOpen === null) continue;
      return {
        opened: true,
        pending: {
          kind: 'CHAPTER',
          step: step.index,
          chapterId: chapterOpen.chapterId,
          version: chapterOpen.version,
          importance: chapterOpen.importance,
          matchId: chapterOpen.matchId,
          decisionsTotal: chapterOpen.decisionsTotal,
          trigger: chapterOpen.trigger,
          resolved: [],
          ...(chapterOpen.virtualOpponent === undefined ? {} : { virtualOpponent: chapterOpen.virtualOpponent }),
        },
        rngState,
      };
    }

    if (slot.kind === 'ROLE') {
      if (roleContext === null) {
        throw new RangeError('selectOpenSlot: ROLE 슬롯을 열려는데 roleContext가 없다.');
      }
      const proposal = computeRoleProposal(roleContext);
      return { opened: true, pending: { kind: 'ROLE_PROPOSAL', step: step.index, proposal }, rngState };
    }

    if (slot.kind === 'CONTRACT') {
      // T-3-002 D-43 (a): 계약이 임대가 아니고 진행 중 시즌이 계약 마지막 시즌이면 현 구단 RENEWAL
      // 제안 1건을 연다. 아니면(계약 잔여 있음) 지금처럼 offers: []로 자동 통과한다. reason
      // 'PRE_NEGOTIATION'은 이 슬롯의 용도(step 7 사전 협상)를 그대로 담는다. 이슈 #147(1.4.0+
      // `contractRules.renewalWindow`): 이번 계약에서 최소 N경기를 뛴 뒤에만 연다(키 없으면 종전대로).
      const contract = state.contract;
      if (contract === null) {
        throw new RangeError('selectOpenSlot: CONTRACT 슬롯을 열려는데 contract가 없다.');
      }
      const isLastSeason =
        contract.kind !== 'LOAN' &&
        computeContractSeasonsRemaining(contract.lengthSeasons, contract.signedAtRevision, state.timeline) === 0;
      const offers =
        isLastSeason && !isYouthExitRequired(state, ruleset) && isRenewalWindowOpen(state, ruleset)
          ? [buildRenewalOffer(state, ruleset, revision)]
          : [];
      const market: MarketSummary = { openedAtRevision: revision, seasonIndex, reason: 'PRE_NEGOTIATION', safeOfferId: null };
      return { opened: true, pending: { kind: 'CONTRACT', step: step.index, offers, market }, rngState };
    }

    if (slot.kind === 'INJURY') {
      // T-3-001 D-52 예약: 생성기(T-4-002)가 없는 지금은 값 없이 형태만 채운다(현재 룰셋에 INJURY
      // 슬롯이 없어 이 분기는 실제로 도달하지 않는다).
      return { opened: true, pending: { kind: 'INJURY', step: step.index, episodeId: '', eventId: '', version: 0 }, rngState };
    }

    // slot.kind === 'NATIONAL_TEAM'. qualification/auto-decline은 모두 RNG 0이다.
    const qualification = qualifyNationalTeam(state, ruleset, step.index);
    if (!qualification.eligible) continue;

    // `injuryUnavailable` is produced by the current step's match wiring. The
    // season value here is the live slot state, never the walk-start snapshot.
    const seasonInjury = state.season?.availability?.kind === 'INJURY';
    if (injuryUnavailable || seasonInjury) {
      return {
        opened: false,
        nationalTeamAutoDecline: buildNationalTeamCallUpRecord(
          state,
          ruleset.nationalTeamRules.event.id,
          ruleset.nationalTeamRules.event.version,
          'DECLINE',
          'INJURY',
          step.index,
        ),
      };
    }
    return {
      opened: true,
      pending: {
        kind: 'NATIONAL_TEAM',
        step: step.index,
        eventId: ruleset.nationalTeamRules.event.id,
        version: ruleset.nationalTeamRules.event.version,
      },
      rngState,
    };
  }

  return { opened: false };
}

export type SeasonWalkResult = {
  steps: SeasonStep[];
  currentStepIndex: number;
  pending: Pending;
  rngState: RngState;
  /** 이번 걷기에서 닫힌 step 번호들, 순서대로(강제 부상만 있었던 재개 step은 1 이상일 수 있다). */
  passedStepIndexes: number[];
  /** 같은 walk 중 자동 INJURY decline으로 갱신된 대표팀 이력. */
  nationalTeamState: CareerState['nationalTeam'];
  nationalTeamTimeline: TimelineEntry[];
};

/**
 * T-2-003 D-35: step 하나의 예정 경기를 결정 슬롯 확인 전에 처리한다. 경기는 `season.rngState`가
 * 아니라 별도 경기 전용 RNG 스트림을 쓴다(호출자가 closure로 관리 — FAST·CHAPTER가 결정 슬롯에서
 * 쓰는 rngState 소비량이 달라도 경기 결과가 byte-identical하도록 결정 RNG와 완전히 분리한다).
 * T-2-004 D-38: `records`는 이 호출 뒤 현재 step에 기록된 `MatchRecord[]`(기존 기록 + 이번에 재생된
 * 기록, 순서대로), `competitions`는 그 경기까지 반영된 현재 대회 기록(DECIDER의 리그 순위 판정용) —
 * `selectChapter`가 이 둘을 쓴다.
 */
export type PlayStepMatches = (stepIndex: number) => {
  results: StepMatchResult[];
  records: MatchRecord[];
  competitions: readonly CompetitionRecord[];
  /** 경기 직후 강제로 열어야 하는 중등도 이상 부상 재활 판단. */
  forcedPending: Extract<Pending, { kind: 'INJURY' }> | null;
  /** 첫 회복 후 첫 실제 출전의 챕터 trigger를 위한 match id. */
  injuryReturnMatchId: string | null;
  /** walk 중 새로 갱신된 health/availability까지 포함한 출전 불가 상태. */
  injuryUnavailable?: boolean;
  /** Live selection/availability snapshot for slots opened after this step. */
  squadRole?: import('./types.js').SquadRole;
  playerStats?: import('./types.js').SeasonPlayerStats;
  availability?: import('./types.js').Availability;
  playerProfile?: import('./types.js').PlayerProfile;
};

/** T-2-004 D-38: `walkToNextDecision`이 매 step마다 `selectChapter`에 넘기는, step에 안 걸리는 맥락. */
export type ChapterWalkContext = {
  chapterCandidates: readonly ChapterCandidateInput[];
  tags: readonly string[];
  resolvedChapterIds: readonly string[];
  existingChapterIds: readonly string[];
  league: League;
  seasonIndex: number;
  /** PR #208 리뷰 후속: 선수 소속 팀의 `Team.rivalTeamId`. selectChapter의 DERBY 판정에 그대로
   * 넘긴다(없으면 기존 이름 없는 상대 로직 폴백). */
  rivalTeamId?: string | undefined;
};

/**
 * RULE-TIME-002: `startStepIndex`부터 다음 결정이 열리는 step 또는 step 12(SETTLEMENT)까지 걷는다.
 * 열리지 않는 step은 같은 호출 안에서 즉시 decisionsOpened: 0으로 닫는다(강제 INJURY를 해소한
 * 뒤 재개한 시작 step은 호출자가 이미 센 강제 결정 수를 넘겨 그 수로 닫는다). 그래서 이 함수가
 * 반환한 뒤에는 항상 "pending이 가리키는 step만 summary가 비어 있다"가 성립한다 — startSeason·
 * advanceInSeason이 공유하는 이 불변식 덕분에, EVENT처럼 RESOLVE_EVENT로 별도 해소되는 pending도
 * "다음에 이 step을 다시 보면 summary가 비어 있으니 결정이 열렸던 step이다"로 정확히 닫힌다).
 * T-2-003 D-35: 각 step의 결정 슬롯을 확인하기 전에 `playStepMatches`로 그 step의 예정 경기를
 * 먼저 처리한다(pending이 열리는 step도 포함 — 그 step이 나중에 닫힐 때 결과를 쓸 수 있도록
 * `season.matches`에 남는다). T-2-004 D-38: 경기를 돌린 직후, `selectOpenSlot` 전에 `selectChapter`를
 * 불러 이 step에 핵심 경기 챕터가 열리는지 본다(roll 없음). `matchesBeforeWalk`는 이 walk 이전에
 * 이미 시즌에 쌓인 경기(전 ADVANCE 호출분, DEBUT의 "커리어 첫 출전" 판정에 필요)이고, 이 walk 동안
 * 재생되는 경기는 step마다 `matchesSoFar`에 누적한다.
 */
export function walkToNextDecision(
  steps: SeasonStep[],
  startStepIndex: number,
  mode: SimulationMode,
  eligibleEvents: readonly EligibleEvent[],
  rngState: RngState,
  revision: number,
  roleContext: RoleProposalContext | null,
  playStepMatches: PlayStepMatches,
  matchesBeforeWalk: readonly MatchRecord[],
  chapterContext: ChapterWalkContext,
  // T-3-002 D-43 (a): `selectOpenSlot`의 CONTRACT 분기(`buildRenewalOffer`)에 그대로 넘긴다(roll 없음).
  state: CareerState,
  ruleset: Ruleset,
  /** RESOLVE_EVENT 뒤 재개한 시작 step에서 이미 해소한 강제 INJURY 결정 수. */
  decisionsAlreadyOpenedForStartStep = 0,
): SeasonWalkResult {
  let currentStepIndex = startStepIndex;
  let pending: Pending = null;
  let nextRngState = rngState;
  let nextSteps = steps;
  let matchesSoFar = [...matchesBeforeWalk];
  const passedStepIndexes: number[] = [];
  let nationalTeamState = state.nationalTeam;
  const nationalTeamTimeline: TimelineEntry[] = [];
  let autoDecisionsThisStep = 0;

  while (currentStepIndex < 12) {
    const step = findSeasonStep(nextSteps, currentStepIndex);
    const matchResult = playStepMatches(currentStepIndex);

    // MODERATE/MAJOR forced injury decision은 모든 일반 EVENT/CHAPTER/CONTRACT보다 우선한다.
    if (matchResult.forcedPending !== null) {
      pending = matchResult.forcedPending;
      break;
    }

    const injuryUnavailable =
      matchResult.injuryUnavailable ?? matchResult.records.some((match) => match.injuredOff);

    const chapterOpen = selectChapter({
      step,
      steps: nextSteps,
      seasonIndex: chapterContext.seasonIndex,
      mode,
      matchesThisStep: matchResult.records,
      matchesBeforeThisStep: matchesSoFar,
      competitions: matchResult.competitions,
      candidates: chapterContext.chapterCandidates,
      tags: chapterContext.tags,
      resolvedChapterIds: chapterContext.resolvedChapterIds,
      existingChapterIds: chapterContext.existingChapterIds,
      league: chapterContext.league,
      rivalTeamId: chapterContext.rivalTeamId,
      injuryReturnMatchId: matchResult.injuryReturnMatchId,
      // An injury discovered after the match must preserve the persistent debut reservation;
      // it cannot open a NATIONAL_DEBUT chapter on an unavailable appearance.
      nationalDebutReservation: injuryUnavailable ? null : nationalTeamState.pendingDebut,
      chapterSelectionRules: ruleset.chapterSelectionRules,
    });
    matchesSoFar = [...matchesSoFar, ...matchResult.records];
    // T-3-001: MarketSummary.seasonIndex는 "시장이 열린 시점의 seasonHistory.length"(D-43) — season.index
    // (1부터 시작)가 아니라 그보다 1 작은 값이다.
    const slotState = () => matchResult.squadRole === undefined || state.season === null
      ? { ...state, nationalTeam: nationalTeamState }
      : {
          ...state,
          nationalTeam: nationalTeamState,
          player: matchResult.playerProfile === undefined
            ? state.player
            : { ...state.player, profile: matchResult.playerProfile },
          season: {
            ...state.season,
            squadRole: matchResult.squadRole,
            playerStats: matchResult.playerStats === undefined ? state.season.playerStats : matchResult.playerStats,
            availability: matchResult.availability === undefined ? state.season.availability : matchResult.availability,
          },
        };
    let opened = selectOpenSlot(
      step,
      mode,
      eligibleEvents,
      nextRngState,
      roleContext,
      chapterOpen,
      revision,
      chapterContext.seasonIndex - 1,
      slotState(),
      ruleset,
      injuryUnavailable,
    );
    while (!opened.opened && opened.nationalTeamAutoDecline !== undefined) {
      const record = opened.nationalTeamAutoDecline;
      nationalTeamState = applyNationalTeamCallUp(nationalTeamState, record);
      autoDecisionsThisStep += 1;
      nationalTeamTimeline.push({
        revision,
        kind: 'NATIONAL_TEAM_DECLINED',
        refId: 'INJURY',
        age: state.age,
        step: step.index,
      });
      opened = selectOpenSlot(
        step,
        mode,
        eligibleEvents,
        nextRngState,
        roleContext,
        chapterOpen,
        revision,
        chapterContext.seasonIndex - 1,
        slotState(),
        ruleset,
        injuryUnavailable,
      );
    }
    if (opened.opened) {
      pending = opened.pending;
      nextRngState = opened.rngState;
      break;
    }
    const decisionsOpened =
      (currentStepIndex === startStepIndex ? decisionsAlreadyOpenedForStartStep : 0) + autoDecisionsThisStep;
    nextSteps = markStepPassed(nextSteps, currentStepIndex, revision, decisionsOpened, matchResult.results);
    passedStepIndexes.push(currentStepIndex);
    currentStepIndex += 1;
    autoDecisionsThisStep = 0;
  }

  if (pending === null && currentStepIndex === 12) {
    pending = { kind: 'SETTLEMENT', step: 12 };
  }

  return {
    steps: nextSteps,
    currentStepIndex,
    pending,
    rngState: nextRngState,
    passedStepIndexes,
    nationalTeamState,
    nationalTeamTimeline,
  };
}

/**
 * ADVANCE가 CONTRACT pending을 "자동 통과"로 닫을 수 있는지. T-2-002 D-34: ROLE은 더 이상 자동 통과
 * 대상이 아니다 — `selectOpenSlot`이 ROLE 슬롯을 `ROLE_PROPOSAL` pending으로 열고, `RESOLVE_ROLE`
 * 명령으로만 닫힌다. T-2-004 D-38: CHAPTER도 같은 이유로 자동 통과 대상에서 뺐다 —
 * `RESOLVE_CHAPTER`로만 닫힌다(판단 1~3개가 각각 roll 1회를 쓴다). T-3-003: CONTRACT는
 * `offers.length === 0`일 때만 자동 통과한다 — 재계약 제안이 있으면 NEGOTIATE·ACCEPT_OFFER·
 * REJECT_OFFER 중 하나로 응답해야 한다(T-3-002의 "제안 있어도 자동 통과" 임시 규칙 제거). T-4-001
 * D-52: INJURY·NATIONAL_TEAM은 자동 통과 대상이 아니다 — `RESOLVE_EVENT`로만 닫힌다.
 */
export function isAutoPassablePending(pending: Pending): boolean {
  if (pending === null) return false;
  if (pending.kind === 'CONTRACT') return pending.offers.length === 0;
  return false;
}

export function markStepPassed(
  steps: SeasonStep[],
  stepIndex: number,
  revision: number,
  decisionsOpened: number,
  results: StepMatchResult[],
): SeasonStep[] {
  return steps.map((step) =>
    step.index === stepIndex
      ? { ...step, summary: { passedAtRevision: revision, decisionsOpened, matchesPlayed: results.length, results } }
      : step,
  );
}

export function findSeasonStep(steps: readonly SeasonStep[], index: number): SeasonStep {
  const step = steps.find((candidate) => candidate.index === index);
  if (step === undefined) {
    throw new RangeError(`findSeasonStep: 시즌에 step ${index}가 없다.`);
  }
  return step;
}
