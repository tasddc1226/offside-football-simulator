import { rollRange } from './roll-range.js';
import type { RngState } from './rng.js';
import type { LeagueCalendar, LeagueCalendarSlot } from './ruleset.js';
import type { CompetitionRecord, DecisionSlot, Pending, SeasonStep, SimulationMode } from './types.js';

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

export type EligibleEvent = { eventId: string; version: number; weight: number };

export type SlotOpenResult =
  | { opened: false }
  | { opened: true; pending: Pending; rngState: RngState; eventId?: string };

/**
 * 한 step의 decisionSlots 중 이번 ADVANCE에서 열 슬롯 하나를 고른다. 예산에 잘린 슬롯과 모드가
 * 거르는 슬롯은 후보에서 빠진다. EVENT는 eligibleEvents가 비어 있으면 건너뛴다(roll 없음, RULE-TIME-004
 * 문서 "eligibleEvents가 비어 있으면 그 슬롯은 건너뛴다"). 나머지 종류는 플레이스홀더로 무조건 연다.
 */
export function selectOpenSlot(
  step: SeasonStep,
  mode: SimulationMode,
  eligibleEvents: readonly EligibleEvent[],
  rngState: RngState,
): SlotOpenResult {
  const candidates = step.decisionSlots
    .filter((slot) => !slot.skippedByBudget)
    .filter((slot) => mode === 'CHAPTER' || isOpenableInFastMode(slot))
    .slice()
    .sort((a, b) => slotPriority(a.kind) - slotPriority(b.kind));

  for (const slot of candidates) {
    if (slot.kind === 'EVENT') {
      if (eligibleEvents.length === 0) continue;
      let chosen = eligibleEvents[0]!;
      let nextRngState = rngState;
      if (eligibleEvents.length >= 2) {
        const weightSum = eligibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rolled = rollRange(rngState, 1, weightSum);
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
      return {
        opened: true,
        pending:
          slot.importance === undefined
            ? { kind: 'CHAPTER', step: step.index }
            : { kind: 'CHAPTER', step: step.index, importance: slot.importance },
        rngState,
      };
    }

    return { opened: true, pending: { kind: slot.kind, step: step.index }, rngState };
  }

  return { opened: false };
}

export type SeasonWalkResult = {
  steps: SeasonStep[];
  currentStepIndex: number;
  pending: Pending;
  rngState: RngState;
  /** 이번 걷기에서 결정 없이 지나간(decisionsOpened: 0) step 번호들, 순서대로. */
  passedStepIndexes: number[];
};

/**
 * RULE-TIME-002: `startStepIndex`부터 다음 결정이 열리는 step 또는 step 12(SETTLEMENT)까지 걷는다.
 * 열리지 않는 step은 같은 호출 안에서 즉시 decisionsOpened: 0으로 닫는다(그래서 이 함수가 반환한
 * 뒤에는 항상 "pending이 가리키는 step만 summary가 비어 있다"가 성립한다 — startSeason·
 * advanceInSeason이 공유하는 이 불변식 덕분에, EVENT처럼 RESOLVE_EVENT로 별도 해소되는 pending도
 * "다음에 이 step을 다시 보면 summary가 비어 있으니 결정이 열렸던 step이다"로 정확히 닫힌다).
 */
export function walkToNextDecision(
  steps: SeasonStep[],
  startStepIndex: number,
  mode: SimulationMode,
  eligibleEvents: readonly EligibleEvent[],
  rngState: RngState,
  revision: number,
): SeasonWalkResult {
  let currentStepIndex = startStepIndex;
  let pending: Pending = null;
  let nextRngState = rngState;
  let nextSteps = steps;
  const passedStepIndexes: number[] = [];

  while (currentStepIndex < 12) {
    const step = findSeasonStep(nextSteps, currentStepIndex);
    const opened = selectOpenSlot(step, mode, eligibleEvents, nextRngState);
    if (opened.opened) {
      pending = opened.pending;
      nextRngState = opened.rngState;
      break;
    }
    nextSteps = markStepPassed(nextSteps, currentStepIndex, revision, 0);
    passedStepIndexes.push(currentStepIndex);
    currentStepIndex += 1;
  }

  if (pending === null && currentStepIndex === 12) {
    pending = { kind: 'SETTLEMENT', step: 12 };
  }

  return { steps: nextSteps, currentStepIndex, pending, rngState: nextRngState, passedStepIndexes };
}

/** ADVANCE가 CHAPTER·CONTRACT·ROLE·INJURY·NATIONAL_TEAM pending을 "자동 통과"로 닫을 수 있는지. */
export function isAutoPassablePending(pending: Pending): boolean {
  return (
    pending !== null &&
    (pending.kind === 'CHAPTER' ||
      pending.kind === 'CONTRACT' ||
      pending.kind === 'ROLE' ||
      pending.kind === 'INJURY' ||
      pending.kind === 'NATIONAL_TEAM')
  );
}

export function markStepPassed(
  steps: SeasonStep[],
  stepIndex: number,
  revision: number,
  decisionsOpened: number,
): SeasonStep[] {
  return steps.map((step) =>
    step.index === stepIndex
      ? { ...step, summary: { passedAtRevision: revision, decisionsOpened, matchesPlayed: 0 } }
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
