import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { runCareerFixture } from './__fixtures__/career-01.js';
import { hashState } from './hash.js';
import { seedRng } from './rng.js';
import type { LeagueCalendar } from './ruleset.js';
import {
  buildInitialCompetitions,
  buildSeasonSteps,
  findSeasonStep,
  isAutoPassablePending,
  selectOpenSlot,
} from './season.js';
import { simulate, type Command, type SimulationInput } from './simulate.js';
import type { DomainSnapshot, Offer, SeasonStep } from './types.js';

function buildTestOffer(): Offer {
  return {
    id: 'OFR-TEST-1',
    kind: 'RENEWAL',
    teamId: 'seoul-tier1',
    teamName: 'Seoul',
    fromTeamId: 'seoul-tier1',
    leagueTier: 1,
    lengthSeasons: 2,
    wageMinorPerWeek: 1000,
    signingBonusMinor: 0,
    transferFeeMinor: null,
    rolePromise: 'BENCH',
    appearancePromise: { minutesShareBp: 2000 },
    positionPlan: 'ST',
    shirtNumber: 9,
    tacticalFitEstimate: 50,
    competitorSummary: null,
    validUntilRevision: null,
    negotiable: { wage: false, role: false, length: false },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
  };
}

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK = '0.1.0';

function baseInput(): Omit<SimulationInput, 'command' | 'snapshot'> {
  return { ruleset: rulesetProto, rulesetVersion: RULESET_VERSION, contentPackVersion: CONTENT_PACK };
}

// 브리프 기본 캘린더(rulesetProto.leagueCalendar)와 같은 구조: step1 ROLE·step12 SETTLEMENT만
// required, 나머지는 EVENT×4(2,4,5,8,9는 아니고 실제로는 5개), CHAPTER×4(3,6,10,11), CONTRACT×1(7).
const DEFAULT_CALENDAR = rulesetProto.leagueCalendar;

describe('buildSeasonSteps: RULE-TIME-004 결정 예산', () => {
  it('CHAPTER 모드에서는 기본 캘린더(선택 슬롯 10개, 챕터 4개)가 잘리지 않는다', () => {
    const steps = buildSeasonSteps(DEFAULT_CALENDAR, 'CHAPTER');
    const cut = steps.flatMap((s) => s.decisionSlots.filter((slot) => slot.skippedByBudget === true));
    expect(cut).toEqual([]);
  });

  it('FAST 모드는 FAST가 여는 선택 슬롯만 예산 후보로 세므로, 기본 캘린더는 아무것도 잘리지 않는다', () => {
    const steps = buildSeasonSteps(DEFAULT_CALENDAR, 'FAST');
    const cut = steps.flatMap((s) => s.decisionSlots.filter((slot) => slot.skippedByBudget === true));
    expect(cut).toEqual([]);

    // FAST가 실제로 여는 선택 슬롯(required 제외)은 MAJOR 챕터(3·11)·CONTRACT(7) 3개뿐이다 —
    // 상한(6)에 못 미쳐 잘릴 것이 없다. EVENT(2·4·5·8·9)·MINOR 챕터(6)·importance 없는 챕터(10)는
    // FAST가 애초에 열지 않으므로(RULE-TIME-003) 예산 후보에도 들어가지 않는다.
    const fastOpenableOptional = steps
      .flatMap((s) => s.decisionSlots.map((slot) => ({ step: s.index, slot })))
      .filter(({ slot }) => !slot.required && (slot.kind === 'CHAPTER' ? slot.importance === 'MAJOR' : slot.kind === 'CONTRACT'));
    expect(fastOpenableOptional.map((r) => r.step)).toEqual([3, 7, 11]);
  });

  it('FAST 모드에서 FAST가 여는 슬롯 수가 상한을 넘으면 그 슬롯들만 절단 대상이다(합성 캘린더)', () => {
    // MAJOR 챕터 5개(step 2~6)+CONTRACT 3개(step 7~9) = FAST가 여는 선택 슬롯 8개로 상한(6)을
    // 넘긴다. step 10 EVENT는 FAST가 애초에 열지 않는 슬롯이 섞여도 후보에서 빠지는지 확인한다.
    const calendar: LeagueCalendar = {
      id: 'test-fast-budget',
      transferWindowStep: 7,
      cupRounds: [],
      steps: [
        { index: 1, phase: 'PRESEASON', windowOpen: false, slots: [{ kind: 'ROLE', required: true }] },
        { index: 2, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 3, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 4, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 5, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 6, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 7, phase: 'LEAGUE', windowOpen: true, slots: [{ kind: 'CONTRACT', required: false }] },
        { index: 8, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CONTRACT', required: false }] },
        { index: 9, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CONTRACT', required: false }] },
        { index: 10, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'EVENT', required: false }] },
        { index: 11, phase: 'LEAGUE', windowOpen: false, slots: [] },
        { index: 12, phase: 'SETTLEMENT', windowOpen: false, slots: [{ kind: 'SETTLEMENT', required: true }] },
      ],
    };

    const steps = buildSeasonSteps(calendar, 'FAST');

    // FAST가 열지 않는 step 10 EVENT는 예산 후보가 아니므로 잘리지 않는다.
    expect(findSeasonStep(steps, 10).decisionSlots[0]?.skippedByBudget).toBeUndefined();

    // 챕터 상한(4): 5개 중 step 내림차순으로 1개(step 6)가 먼저 잘린다.
    expect(findSeasonStep(steps, 6).decisionSlots[0]?.skippedByBudget).toBe(true);
    expect(findSeasonStep(steps, 2).decisionSlots[0]?.skippedByBudget).toBeUndefined();

    // 총 상한(FAST 6): 남은 7개(챕터 4+CONTRACT 3) 중 step 내림차순으로 1개(step 9 CONTRACT)가 더 잘린다.
    expect(findSeasonStep(steps, 9).decisionSlots[0]?.skippedByBudget).toBe(true);
    expect(findSeasonStep(steps, 7).decisionSlots[0]?.skippedByBudget).toBeUndefined();
    expect(findSeasonStep(steps, 8).decisionSlots[0]?.skippedByBudget).toBeUndefined();

    const openableRemaining = steps
      .flatMap((s) => s.decisionSlots.map((slot) => ({ step: s.index, slot })))
      .filter(({ slot }) => !slot.required && !slot.skippedByBudget && (slot.kind === 'CHAPTER' || slot.kind === 'CONTRACT'));
    expect(openableRemaining.map((r) => r.step)).toEqual([2, 3, 4, 5, 7, 8]);
  });

  it('required 슬롯(step1 ROLE·step12 SETTLEMENT)은 절대 잘리지 않는다', () => {
    const steps = buildSeasonSteps(DEFAULT_CALENDAR, 'FAST');
    expect(findSeasonStep(steps, 1).decisionSlots[0]?.skippedByBudget).toBeUndefined();
    expect(findSeasonStep(steps, 12).decisionSlots[0]?.skippedByBudget).toBeUndefined();
  });

  it('챕터 상한(4)을 넘으면 같은 step에서 importance MINOR가 먼저 잘린다', () => {
    const calendar: LeagueCalendar = {
      id: 'test-chapter-tiebreak',
      transferWindowStep: 7,
      cupRounds: [],
      steps: [
        { index: 1, phase: 'PRESEASON', windowOpen: false, slots: [{ kind: 'ROLE', required: true }] },
        { index: 2, phase: 'PRESEASON', windowOpen: false, slots: [] },
        { index: 3, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 4, phase: 'LEAGUE', windowOpen: false, slots: [] },
        { index: 5, phase: 'LEAGUE', windowOpen: false, slots: [] },
        { index: 6, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MINOR' }] },
        { index: 7, phase: 'LEAGUE', windowOpen: true, slots: [] },
        { index: 8, phase: 'LEAGUE', windowOpen: false, slots: [] },
        { index: 9, phase: 'LEAGUE', windowOpen: false, slots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }] },
        { index: 10, phase: 'LEAGUE', windowOpen: false, slots: [] },
        {
          index: 11,
          phase: 'LEAGUE',
          windowOpen: false,
          slots: [
            { kind: 'CHAPTER', required: false, importance: 'MAJOR' },
            { kind: 'CHAPTER', required: false, importance: 'MINOR' },
          ],
        },
        { index: 12, phase: 'SETTLEMENT', windowOpen: false, slots: [{ kind: 'SETTLEMENT', required: true }] },
      ],
    };

    const steps = buildSeasonSteps(calendar, 'CHAPTER');
    const step11 = findSeasonStep(steps, 11);
    const major11 = step11.decisionSlots.find((s) => s.importance === 'MAJOR');
    const minor11 = step11.decisionSlots.find((s) => s.importance === 'MINOR');
    expect(minor11?.skippedByBudget).toBe(true);
    expect(major11?.skippedByBudget).toBeUndefined();

    // 나머지 챕터(step3·6·9)는 살아남는다: 총 5개 중 1개만 잘려 4개가 남는다.
    const survivingChapters = steps
      .flatMap((s) => s.decisionSlots)
      .filter((slot) => slot.kind === 'CHAPTER' && !slot.skippedByBudget);
    expect(survivingChapters).toHaveLength(4);
  });
});

describe('buildInitialCompetitions', () => {
  it('LEAGUE·CUP 두 종목을 값 0으로 초기화한다', () => {
    const competitions = buildInitialCompetitions(DEFAULT_CALENDAR);
    expect(competitions).toEqual([
      { competitionId: 'LEAGUE', kind: 'LEAGUE', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, position: null, cupRound: null },
      { competitionId: 'CUP', kind: 'CUP', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, position: null, cupRound: 'R1' },
    ]);
  });
});

describe('selectOpenSlot: RULE-TIME-002/003', () => {
  const rng = seedRng('select-open-slot-test');
  // T-3-002 D-43 (a): CONTRACT 분기가 `state.contract`·`ruleset`을 쓴다. career-01 fixture의 계약은
  // lengthSeasons 3·이제 막 서명(SEASON_STARTED 0회)이라 잔여 3시즌 — 마지막 시즌이 아니므로 이
  // 블록의 기존 기대값(offers: [])에 영향을 주지 않는다.
  const testState = runCareerFixture().state;

  it('같은 step에 CONTRACT·EVENT·CHAPTER가 있으면 CONTRACT가 먼저 열린다', () => {
    const step: SeasonStep = {
      index: 7,
      phase: 'LEAGUE',
      windowOpen: true,
      decisionSlots: [
        { kind: 'CHAPTER', required: false, importance: 'MAJOR' },
        { kind: 'EVENT', required: false },
        { kind: 'CONTRACT', required: false },
      ],
      summary: null,
    };
    const result = selectOpenSlot(step, 'CHAPTER', [{ eventId: 'EVT-X', version: 1, weight: 1 }], rng, null, null, 1, 0, testState, rulesetProto);
    expect(result.opened).toBe(true);
    if (result.opened) expect(result.pending?.kind).toBe('CONTRACT');
  });

  it('EVENT는 eligibleEvents가 비어 있으면 열지 않는다(roll 없음)', () => {
    const step: SeasonStep = {
      index: 4,
      phase: 'LEAGUE',
      windowOpen: false,
      decisionSlots: [{ kind: 'EVENT', required: false }],
      summary: null,
    };
    const result = selectOpenSlot(step, 'CHAPTER', [], rng, null, null, 1, 0, testState, rulesetProto);
    expect(result).toEqual({ opened: false });
  });

  // T-2-004 D-38: CHAPTER는 이제 `selectChapter`가 미리 계산한 `chapterOpen`이 있어야 열린다 — 이
  // 슬롯 자체는 `selectOpenSlot`의 관심사가 아니므로(FAST가 애초에 후보를 안 걸러낸 MAJOR 챕터
  // 슬롯이라도) chapterOpen이 null이면 열지 않고, 있으면 그 값 그대로 pending에 옮긴다.
  it('FAST 모드는 MINOR 챕터 슬롯을 후보에서 아예 거르고, MAJOR 챕터는 chapterOpen이 있어야 연다', () => {
    const minorStep: SeasonStep = {
      index: 6,
      phase: 'LEAGUE',
      windowOpen: false,
      decisionSlots: [{ kind: 'CHAPTER', required: false, importance: 'MINOR' }],
      summary: null,
    };
    const chapterOpen = {
      chapterId: 'CHP-TEST-001',
      version: 1,
      importance: 'MAJOR' as const,
      matchId: 'test-match',
      decisionsTotal: 1,
      trigger: 'DEBUT' as const,
    };
    expect(selectOpenSlot(minorStep, 'FAST', [], rng, null, chapterOpen, 1, 0, testState, rulesetProto)).toEqual({ opened: false });

    const majorStep: SeasonStep = {
      index: 3,
      phase: 'LEAGUE',
      windowOpen: false,
      decisionSlots: [{ kind: 'CHAPTER', required: false, importance: 'MAJOR' }],
      summary: null,
    };
    expect(selectOpenSlot(majorStep, 'FAST', [], rng, null, null, 1, 0, testState, rulesetProto)).toEqual({ opened: false });
    const result = selectOpenSlot(majorStep, 'FAST', [], rng, null, chapterOpen, 1, 0, testState, rulesetProto);
    expect(result.opened).toBe(true);
    if (result.opened) expect(result.pending).toEqual({ kind: 'CHAPTER', step: 3, resolved: [], ...chapterOpen });
  });

  it('skippedByBudget 슬롯은 모드와 무관하게 열리지 않는다', () => {
    const step: SeasonStep = {
      index: 7,
      phase: 'LEAGUE',
      windowOpen: true,
      decisionSlots: [{ kind: 'CONTRACT', required: false, skippedByBudget: true }],
      summary: null,
    };
    expect(selectOpenSlot(step, 'CHAPTER', [], rng, null, null, 1, 0, testState, rulesetProto)).toEqual({ opened: false });
  });
});

const EMPTY_MARKET = { openedAtRevision: 1, seasonIndex: 0, reason: 'PRE_NEGOTIATION' as const, safeOfferId: null };
const EMPTY_MARKET_SUMMARY = { openedAtRevision: 1, seasonIndex: 0, reason: 'FIRST_CONTRACT' as const, safeOfferId: null };

describe('isAutoPassablePending', () => {
  it('CONTRACT·INJURY·NATIONAL_TEAM만 자동 통과 대상이다', () => {
    expect(isAutoPassablePending({ kind: 'CONTRACT', step: 7, offers: [], market: EMPTY_MARKET })).toBe(true);
    expect(isAutoPassablePending({ kind: 'INJURY', step: 5, episodeId: '', eventId: '', version: 0 })).toBe(true);
    expect(isAutoPassablePending({ kind: 'NATIONAL_TEAM', step: 8, eventId: '', version: 0 })).toBe(true);
    expect(isAutoPassablePending({ kind: 'EVENT', eventId: 'x', version: 1 })).toBe(false);
    expect(isAutoPassablePending({ kind: 'OFFERS', offers: [], market: EMPTY_MARKET_SUMMARY })).toBe(false);
    expect(isAutoPassablePending({ kind: 'SETTLEMENT', step: 12 })).toBe(false);
    expect(isAutoPassablePending(null)).toBe(false);
  });

  // T-3-002 D-43: NEGOTIATE/ACCEPT_OFFER v2가 아직 없어(T-3-003) CONTRACT의 제안을 사람이 처리할
  // 방법이 없다 — offers.length와 무관하게 자동 통과시키고 만료 처리한다(simulate.ts의 OFFER_EXPIRED
  // 타임라인 기록과 짝을 이루는 임시 규칙, T-3-003이 뒤집는다).
  it('CONTRACT는 offers.length > 0이어도 자동 통과한다(임시 규칙)', () => {
    const offer = buildTestOffer();
    expect(isAutoPassablePending({ kind: 'CONTRACT', step: 7, offers: [offer], market: EMPTY_MARKET })).toBe(true);
  });

  // T-2-002 D-34: ROLE은 더 이상 자동 통과 대상이 아니다 — RESOLVE_ROLE로만 닫힌다.
  it('ROLE_PROPOSAL은 자동 통과 대상이 아니다', () => {
    expect(
      isAutoPassablePending({ kind: 'ROLE_PROPOSAL', step: 1, proposal: { type: 'KEEP', position: 'W', squadRole: 'STARTER' } }),
    ).toBe(false);
  });

  // T-2-004 D-38: CHAPTER도 판단 1~3개가 각각 roll을 쓰므로 더 이상 자동 통과 대상이 아니다 —
  // RESOLVE_CHAPTER로만 닫힌다.
  it('CHAPTER는 자동 통과 대상이 아니다', () => {
    expect(
      isAutoPassablePending({
        kind: 'CHAPTER',
        step: 3,
        chapterId: 'CHP-MATCH-001',
        version: 1,
        importance: 'MAJOR',
        matchId: 'm1',
        decisionsTotal: 1,
        trigger: 'DEBUT',
        resolved: [],
      }),
    ).toBe(false);
  });
});

// ---- 통합 테스트: career-01 fixture로 계약까지 만든 뒤 START_SEASON/ADVANCE/SETTLE_SEASON ----

function activeSnapshotWithContract(): DomainSnapshot {
  return runCareerFixture();
}

function startSeasonCommand(revision: number, mode: 'FAST' | 'CHAPTER'): Command & { commandId: string; expectedRevision: number } {
  return {
    type: 'START_SEASON',
    commandId: `start-${revision}`,
    expectedRevision: revision,
    payload: { simulationMode: mode, serviceSeasonId: 'svc-test' },
  };
}

function advanceCommand(
  revision: number,
  eligibleEvents: Array<{ eventId: string; version: number; weight: number }> = [],
): Command & { commandId: string; expectedRevision: number } {
  return { type: 'ADVANCE', commandId: `advance-${revision}`, expectedRevision: revision, payload: { eligibleEvents } };
}

function settleSeasonCommand(revision: number): Command & { commandId: string; expectedRevision: number } {
  return { type: 'SETTLE_SEASON', commandId: `settle-${revision}`, expectedRevision: revision, payload: {} };
}

function resolveRoleCommand(
  revision: number,
  decision: 'ACCEPT' | 'DECLINE' = 'ACCEPT',
): Command & { commandId: string; expectedRevision: number } {
  return { type: 'RESOLVE_ROLE', commandId: `role-${revision}`, expectedRevision: revision, payload: { decision } };
}

function runSimulate(snapshot: DomainSnapshot, command: Command & { commandId: string; expectedRevision: number }) {
  return simulate({ ...baseInput(), snapshot, command });
}

/**
 * START_SEASON부터 SETTLE_SEASON까지, pending 종류에 맞춰 자동으로 명령을 이어 보낸다. T-2-002:
 * ROLE_PROPOSAL은 더 이상 자동 통과 대상이 아니라 RESOLVE_ROLE(ACCEPT)로 직접 닫는다.
 */
function playFullSeason(startSnapshot: DomainSnapshot, mode: 'FAST' | 'CHAPTER'): DomainSnapshot {
  const started = runSimulate(startSnapshot, startSeasonCommand(startSnapshot.revision, mode));
  if (!started.ok) throw new Error(`START_SEASON 실패: ${started.error.code} ${started.error.message}`);
  let snapshot = started.snapshot;

  for (let guard = 0; guard < 100; guard++) {
    const pending = snapshot.state.pending;
    if (pending?.kind === 'SETTLEMENT') {
      const settled = runSimulate(snapshot, settleSeasonCommand(snapshot.revision));
      if (!settled.ok) throw new Error(`SETTLE_SEASON 실패: ${settled.error.code} ${settled.error.message}`);
      return settled.snapshot;
    }
    if (pending?.kind === 'ROLE_PROPOSAL') {
      const resolved = runSimulate(snapshot, resolveRoleCommand(snapshot.revision, 'ACCEPT'));
      if (!resolved.ok) throw new Error(`RESOLVE_ROLE 실패: ${resolved.error.code} ${resolved.error.message}`);
      snapshot = resolved.snapshot;
      continue;
    }
    // pending이 null이거나(RESOLVE_ROLE·RESOLVE_EVENT 직후) 자동 통과 대상이면 ADVANCE로 진행한다.
    const result = runSimulate(snapshot, advanceCommand(snapshot.revision));
    if (!result.ok) throw new Error(`ADVANCE 실패: ${result.error.code} ${result.error.message}`);
    snapshot = result.snapshot;
  }
  throw new Error('playFullSeason: 100회 반복해도 시즌이 끝나지 않았다.');
}

describe('START_SEASON (CMD-SIM-001)', () => {
  it('계약이 없으면 NO_CONTRACT다', () => {
    // ACTIVE·season null·pending null이지만 contract만 없는 상태를 직접 구성한다
    // (CREATE_CAREER 직후는 status가 DRAFT라 NOT_ACTIVE가 먼저 걸린다).
    const snapshot = activeSnapshotWithContract();
    const noContract: DomainSnapshot = { ...snapshot, state: { ...snapshot.state, contract: null } };
    const rehashed: DomainSnapshot = { ...noContract, stateHash: hashState(noContract.state) };
    const result = runSimulate(rehashed, startSeasonCommand(rehashed.revision, 'FAST'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NO_CONTRACT' });
  });

  it('이미 활성 시즌이 있으면 SEASON_ALREADY_ACTIVE다', () => {
    const snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'FAST'));
    if (!started.ok) throw new Error('setup 실패');
    // 첫 step의 ROLE_PROPOSAL을 RESOLVE_ROLE(ACCEPT)로 닫아 pending을 비운 뒤 다시 START_SEASON을 보낸다.
    const resolved = runSimulate(started.snapshot, resolveRoleCommand(started.snapshot.revision, 'ACCEPT'));
    if (!resolved.ok) throw new Error('setup 실패');
    const result = runSimulate(resolved.snapshot, startSeasonCommand(resolved.snapshot.revision, 'FAST'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'SEASON_ALREADY_ACTIVE' });
  });

  it('pending이 있으면 PENDING_DECISION이다', () => {
    // season null·contract 있음이지만 pending만 남아 있는 상태를 직접 구성한다
    // (season이 있으면 SEASON_ALREADY_ACTIVE가, contract가 없으면 NO_CONTRACT가 먼저 걸린다).
    const snapshot = activeSnapshotWithContract();
    const withPending: DomainSnapshot = {
      ...snapshot,
      state: { ...snapshot.state, pending: { kind: 'EVENT', eventId: 'EVT-X', version: 1 } },
    };
    const rehashed: DomainSnapshot = { ...withPending, stateHash: hashState(withPending.state) };
    const result = runSimulate(rehashed, startSeasonCommand(rehashed.revision, 'FAST'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'PENDING_DECISION' });
  });

  it('RETIRED면 NOT_ACTIVE다', () => {
    const snapshot = activeSnapshotWithContract();
    const retired: DomainSnapshot = { ...snapshot, state: { ...snapshot.state, status: 'RETIRED' } };
    const rehashed: DomainSnapshot = { ...retired, stateHash: hashState(retired.state) };
    const result = runSimulate(rehashed, startSeasonCommand(rehashed.revision, 'FAST'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'NOT_ACTIVE' });
  });

  it('성공하면 시즌 1이 열리고 SEASON_STARTED 타임라인·competitions가 초기화된다', () => {
    const snapshot = activeSnapshotWithContract();
    const result = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'CHAPTER'));
    if (!result.ok) throw new Error(`실패: ${result.error.code} ${result.error.message}`);
    const state = result.snapshot.state;
    expect(state.season?.index).toBe(1);
    expect(state.season?.currentStep).toBe(1);
    expect(state.season?.simulationMode).toBe('CHAPTER');
    expect(state.season?.competitions).toEqual(buildInitialCompetitions(DEFAULT_CALENDAR));
    expect(state.currentStep).toBe(1);
    expect(state.timeline.at(-1)).toMatchObject({ kind: 'SEASON_STARTED', step: 1 });
    // T-2-002 D-34: step1 ROLE은 required라 즉시 열리지만, 더 이상 플레이스홀더가 아니라
    // computeRoleProposal이 산출한 실제 ROLE_PROPOSAL이다(roll 없음, RESOLVE_ROLE로만 닫힌다).
    const pending = state.pending;
    expect(pending?.kind).toBe('ROLE_PROPOSAL');
    if (pending?.kind === 'ROLE_PROPOSAL') {
      expect(pending.step).toBe(1);
      expect(['KEEP', 'POSITION_CHANGE', 'ROLE_CHANGE']).toContain(pending.proposal.type);
    }
    // T-2-002 D-26/D-34: 경쟁자·전술 스타일·선발 순위도 START_SEASON에서 함께 채워진다.
    expect(state.season?.styleId).toBe('possession');
    expect(state.season?.squad.competitors.length).toBeGreaterThan(0);
    expect(state.season?.selection.candidates.some((c) => c.id === 'PLAYER')).toBe(true);
  });
});

describe('ADVANCE(시즌 중): RULE-TIME-002', () => {
  it('결정 없는 step을 건너뛰고 다음 결정 step에서 멈춘다. currentStep은 되돌아가지 않는다', () => {
    const snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'CHAPTER'));
    if (!started.ok) throw new Error('setup 실패');

    // step1 ROLE_PROPOSAL을 RESOLVE_ROLE(ACCEPT)로 닫고 → step2 EVENT(eligibleEvents 없음, 건너뜀) →
    // T-2-004 D-38: chapterCandidates를 안 보내면 step3·6(CHAPTER)도 후보가 없어 열리지 않고
    // 지나간다 → step4·5(EVENT, 건너뜀) → step7 CONTRACT에서 멈춘다.
    const roleResolved = runSimulate(started.snapshot, resolveRoleCommand(started.snapshot.revision, 'ACCEPT'));
    if (!roleResolved.ok) throw new Error('setup 실패');
    const advanced = runSimulate(roleResolved.snapshot, advanceCommand(roleResolved.snapshot.revision));
    if (!advanced.ok) throw new Error(`실패: ${advanced.error.code} ${advanced.error.message}`);
    const state = advanced.snapshot.state;
    expect(state.season?.currentStep).toBe(7);
    // T-3-001 D-43 (a): 생성기가 없는 지금은 항상 offers: []로 열린다(자동 통과 대상).
    expect(state.pending).toEqual({
      kind: 'CONTRACT',
      step: 7,
      offers: [],
      market: { openedAtRevision: advanced.snapshot.revision, seasonIndex: 0, reason: 'PRE_NEGOTIATION', safeOfferId: null },
    });
    expect(findSeasonStep(state.season!.steps, 1).summary?.decisionsOpened).toBe(1);
    expect(findSeasonStep(state.season!.steps, 2).summary?.decisionsOpened).toBe(0);
    expect(findSeasonStep(state.season!.steps, 3).summary?.decisionsOpened).toBe(0);
    expect(findSeasonStep(state.season!.steps, 6).summary?.decisionsOpened).toBe(0);
    expect(findSeasonStep(state.season!.steps, 7).summary).toBeNull();

    const stepPassedRevisions = state.timeline.filter((t) => t.kind === 'STEP_PASSED').map((t) => t.step);
    expect(stepPassedRevisions).toEqual([1, 2, 3, 4, 5, 6]);

    const previousStep = state.season!.currentStep;
    const next = runSimulate(advanced.snapshot, advanceCommand(advanced.snapshot.revision));
    if (!next.ok) throw new Error('실패');
    expect(next.snapshot.state.season!.currentStep).toBeGreaterThanOrEqual(previousStep);
  });

  it('같은 seed에서 FAST가 여는 결정 집합은 CHAPTER가 여는 결정 집합의 부분집합이고, 건너뛴 슬롯은 rng를 소비하지 않는다', () => {
    const snapshotFast = activeSnapshotWithContract();
    const snapshotChapter = activeSnapshotWithContract();
    expect(snapshotFast.stateHash).toBe(snapshotChapter.stateHash);

    const fastFinal = playFullSeason(snapshotFast, 'FAST');
    const chapterFinal = playFullSeason(snapshotChapter, 'CHAPTER');

    // FAST가 연 결정(pending을 발생시킨 step) 집합이 CHAPTER의 부분집합인지, StepSummary로 확인한다.
    // playFullSeason은 SETTLE_SEASON까지 실행하므로 seasonHistory[0]에서 확인한다.
    expect(fastFinal.state.seasonHistory).toHaveLength(1);
    expect(chapterFinal.state.seasonHistory).toHaveLength(1);
    // FAST 시즌 전체가 소비한 rng draw 수는 CHAPTER보다 많을 수 없다(건너뛴 EVENT/MINOR 챕터는 roll이 없다).
    expect(fastFinal.state.rngState.draws).toBeLessThanOrEqual(chapterFinal.state.rngState.draws);
  });

  it('EVENT 슬롯이 RESOLVE_EVENT로 해소되면, 다음 ADVANCE가 그 step을 decisionsOpened:1로 정확히 닫는다', () => {
    // 회귀 테스트: advanceInSeason이 "이전 pending이 non-null"만 보고 현재 step을 닫으면, RESOLVE_EVENT로
    // 이미 pending이 null이 된(EVENT는 자동 통과 대상이 아니다) step은 다음 ADVANCE에서
    // decisionsOpened: 0으로 잘못 닫힌다. walkToNextDecision 불변식(summary === null이면 결정이
    // 열렸던 step)으로 고쳤다 — 이 테스트가 그 수정을 고정한다.
    const snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'CHAPTER'));
    if (!started.ok) throw new Error('setup 실패');

    // step1 ROLE_PROPOSAL을 RESOLVE_ROLE(ACCEPT)로 닫고 → step2 EVENT(eligibleEvents 하나 제공)에서 멈춘다.
    const roleResolved = runSimulate(started.snapshot, resolveRoleCommand(started.snapshot.revision, 'ACCEPT'));
    if (!roleResolved.ok) throw new Error('setup 실패');
    const opened = runSimulate(
      roleResolved.snapshot,
      advanceCommand(roleResolved.snapshot.revision, [{ eventId: 'EVT-SEASON-TEST', version: 1, weight: 1 }]),
    );
    if (!opened.ok) throw new Error(`실패: ${opened.error.code} ${opened.error.message}`);
    expect(opened.snapshot.state.pending).toEqual({ kind: 'EVENT', eventId: 'EVT-SEASON-TEST', version: 1 });
    expect(opened.snapshot.state.season?.currentStep).toBe(2);

    const resolved = runSimulate(opened.snapshot, {
      type: 'RESOLVE_EVENT',
      commandId: 'resolve-1',
      expectedRevision: opened.snapshot.revision,
      payload: {
        eventId: 'EVT-SEASON-TEST',
        definitionVersion: 1,
        choiceId: 'A',
        outcomes: [{ id: 'A1', weight: 100, effects: [] }],
      },
    });
    if (!resolved.ok) throw new Error(`실패: ${resolved.error.code} ${resolved.error.message}`);
    expect(resolved.snapshot.state.pending).toBeNull();
    // RESOLVE_EVENT는 season을 건드리지 않는다 — step2는 아직 summary가 비어 있다.
    expect(findSeasonStep(resolved.snapshot.state.season!.steps, 2).summary).toBeNull();

    const closed = runSimulate(resolved.snapshot, advanceCommand(resolved.snapshot.revision));
    if (!closed.ok) throw new Error(`실패: ${closed.error.code} ${closed.error.message}`);
    const step2Summary = findSeasonStep(closed.snapshot.state.season!.steps, 2).summary;
    expect(step2Summary).toEqual({
      passedAtRevision: closed.snapshot.revision,
      decisionsOpened: 1,
      matchesPlayed: 0,
      results: [],
    });
    expect(closed.snapshot.state.season?.currentStep).toBeGreaterThan(2);
  });

  it('시즌 중 walk가 여러 step을 건너뛰어도, 지나간 step마다 AT_STEP 효과를 만료시킨다', () => {
    // 회귀 테스트: Phase 1 advance()는 매 step 전환마다 expireEffects를 부르지만, 시즌 walk가 한
    // ADVANCE에서 여러 step을 한 번에 건너뛰면(FAST의 예산 절단·EVENT 후보 없음 등) 그 사이에 있는
    // step에 걸린 AT_STEP 효과가 만료되지 않는 문제가 있었다. advanceEffectsThroughWalk가 walk가
    // 지나간 step마다 순서대로 expireEffects를 접어 적용해 고쳤다.
    const snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'CHAPTER'));
    if (!started.ok) throw new Error('setup 실패');

    // step1 ROLE_PROPOSAL을 RESOLVE_ROLE(ACCEPT)로 닫고 → step2 EVENT에서 멈춘다(eligibleEvents 제공).
    const roleResolved = runSimulate(started.snapshot, resolveRoleCommand(started.snapshot.revision, 'ACCEPT'));
    if (!roleResolved.ok) throw new Error('setup 실패');
    const opened = runSimulate(
      roleResolved.snapshot,
      advanceCommand(roleResolved.snapshot.revision, [{ eventId: 'EVT-EFFECT-TEST', version: 1, weight: 1 }]),
    );
    if (!opened.ok) throw new Error(`실패: ${opened.error.code} ${opened.error.message}`);
    expect(opened.snapshot.state.season?.currentStep).toBe(2);
    const beforeFans = opened.snapshot.state.relationships.fans;

    // step2 EVENT를 fans +10(AT_STEP 5 만료) 효과로 해소한다. fans는 selection·매치 계산 어디에도
    // 쓰이지 않으므로(form·morale과 달리) 경기 결과에 영향을 주지 않고 순수히 effect 만료 회귀만
    // 검증할 수 있다.
    const resolved = runSimulate(opened.snapshot, {
      type: 'RESOLVE_EVENT',
      commandId: 'resolve-effect-1',
      expectedRevision: opened.snapshot.revision,
      payload: {
        eventId: 'EVT-EFFECT-TEST',
        definitionVersion: 1,
        choiceId: 'A',
        outcomes: [
          {
            id: 'A1',
            weight: 100,
            effects: [
              {
                kind: 'RELATION',
                sourceId: 'test-effect-src-t2001',
                target: 'fans',
                delta: 10,
                clamp: { min: 0, max: 100 },
                appliesAt: { kind: 'IMMEDIATE' },
                expiresAt: { kind: 'AT_STEP', step: 5 },
                stackingRule: 'ONCE_PER_SOURCE',
              },
            ],
          },
        ],
      },
    });
    if (!resolved.ok) throw new Error(`실패: ${resolved.error.code} ${resolved.error.message}`);
    expect(resolved.snapshot.state.activeEffects).toHaveLength(1);
    const afterEffectFans = resolved.snapshot.state.relationships.fans;
    expect(afterEffectFans).toBe(Math.min(beforeFans + 10, 100));

    // T-2-004 D-38: chapterCandidates를 안 보내면 step3·6(CHAPTER)도 후보가 없어 열리지 않으므로,
    // step2를 닫은 뒤 한 ADVANCE가 step3~6(CHAPTER·EVENT·EVENT·CHAPTER, 전부 건너뜀)을 한 번에 지나
    // step7(CONTRACT)에서 멈춘다 — step5의 AT_STEP 효과가 이 한 번의 walk 안에서 만료돼야 한다.
    // advanceEffectsThroughWalk가 walk가 지나간 step마다(step5 포함) 순서대로 적용되지 않으면 이
    // 회귀가 통과하지 않는다.
    const afterWalk = runSimulate(resolved.snapshot, advanceCommand(resolved.snapshot.revision));
    if (!afterWalk.ok) throw new Error(`실패: ${afterWalk.error.code} ${afterWalk.error.message}`);
    expect(afterWalk.snapshot.state.season?.currentStep).toBe(7);
    expect(afterWalk.snapshot.state.activeEffects).toEqual([]);
    expect(afterWalk.snapshot.state.relationships.fans).toBe(beforeFans);
  });

  // T-2-003 D-35 필수 테스트 벡터: 이 시나리오의 팀(seoul-tier1)은 실제 리그 일정이 있어(schedule.ts)
  // step을 지날 때마다 경기가 낀다 — "경기가 낀 시나리오"에서도 재개 hash가 연속 실행과 같음을 검증한다.
  it('step 경계 Snapshot에서 재개한 진행의 결산 hash가 연속 실행과 같다(RESOLVE_ROLE·경기 포함 시나리오)', () => {
    const continuous = playFullSeason(activeSnapshotWithContract(), 'CHAPTER');

    const startSnapshot = activeSnapshotWithContract();
    const started = runSimulate(startSnapshot, startSeasonCommand(startSnapshot.revision, 'CHAPTER'));
    if (!started.ok) throw new Error('setup 실패');
    // step1 ROLE_PROPOSAL을 RESOLVE_ROLE(ACCEPT)로 닫고 한 번 더 진행한 뒤, JSON round-trip으로
    // "checkpoint에서 재개"를 흉내낸다.
    const roleResolved = runSimulate(started.snapshot, resolveRoleCommand(started.snapshot.revision, 'ACCEPT'));
    if (!roleResolved.ok) throw new Error('setup 실패');
    const oneStepIn = runSimulate(roleResolved.snapshot, advanceCommand(roleResolved.snapshot.revision));
    if (!oneStepIn.ok) throw new Error('setup 실패');
    // step3부터 리그 경기가 있으므로(schedule.ts) 이 시점에 이미 경기가 낀 상태여야 한다.
    expect((oneStepIn.snapshot.state.season?.matches.length ?? 0)).toBeGreaterThan(0);
    const resumed = JSON.parse(JSON.stringify(oneStepIn.snapshot)) as DomainSnapshot;
    expect(resumed.stateHash).toBe(oneStepIn.snapshot.stateHash);

    let snapshot = resumed;
    for (let guard = 0; guard < 100; guard++) {
      const pending = snapshot.state.pending;
      if (pending?.kind === 'SETTLEMENT') {
        const settled = runSimulate(snapshot, settleSeasonCommand(snapshot.revision));
        if (!settled.ok) throw new Error('실패');
        expect(settled.snapshot.stateHash).toBe(continuous.stateHash);
        return;
      }
      const result = runSimulate(snapshot, advanceCommand(snapshot.revision));
      if (!result.ok) throw new Error('실패');
      snapshot = result.snapshot;
    }
    throw new Error('재개 진행이 끝나지 않았다.');
  });
});

describe('SETTLE_SEASON (CMD-SIM-003)', () => {
  it('step 12 전이면 SEASON_NOT_SETTLEABLE이다', () => {
    const snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'FAST'));
    if (!started.ok) throw new Error('setup 실패');
    const result = runSimulate(started.snapshot, settleSeasonCommand(started.snapshot.revision));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'SEASON_NOT_SETTLEABLE' });
  });

  it('시즌이 없으면 SEASON_NOT_SETTLEABLE이다', () => {
    const snapshot = activeSnapshotWithContract();
    const result = runSimulate(snapshot, settleSeasonCommand(snapshot.revision));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ reason: 'SEASON_NOT_SETTLEABLE' });
  });

  it('성공하면 seasonHistory 1건, season null, age+1, 상태가 회귀하고 능력치는 성장식 결과와 일치한다', () => {
    const before = activeSnapshotWithContract();
    const ageBefore = before.state.age;

    const settled = playFullSeason(before, 'FAST');
    expect(settled.state.season).toBeNull();
    expect(settled.state.seasonHistory).toHaveLength(1);
    expect(settled.state.seasonHistory[0]?.index).toBe(1);
    expect(settled.state.age).toBe(ageBefore + 1);
    expect(settled.state.state).toEqual(rulesetProto.seasonBoundaryReset);
    // T-2-005 D-39: 능력치는 더 이상 결산 전후로 그대로가 아니다 — 성장식 결과(attributeDeltas)로
    // 갱신되고, 갱신된 값이 곧 seasonHistory[0].result.attributes에 기록된 baseOvr.after와 정합한다.
    const result = settled.state.seasonHistory[0]?.result;
    expect(result).toBeDefined();
    expect(settled.state.player.profile?.baseOvr).toBe(result?.baseOvr.after);
    expect(settled.state.timeline.at(-1)).toMatchObject({ kind: 'SEASON_SETTLED' });
  });

  it('성공하면 nextAction이 DECISION이다(결산 다음은 새 시즌을 열지 말지 결정하는 화면)', () => {
    // 회귀 테스트: season이 null이 된 채로 nextAction이 'ADVANCE'면, 클라이언트가 그대로 ADVANCE를
    // 보낼 때 seasonPhase가 SETTLEMENT로 남아 있어 NOTHING_TO_ADVANCE로 실패한다.
    let snapshot = activeSnapshotWithContract();
    const started = runSimulate(snapshot, startSeasonCommand(snapshot.revision, 'FAST'));
    if (!started.ok) throw new Error('setup 실패');
    snapshot = started.snapshot;

    for (let guard = 0; guard < 100 && snapshot.state.pending?.kind !== 'SETTLEMENT'; guard++) {
      const command =
        snapshot.state.pending?.kind === 'ROLE_PROPOSAL'
          ? resolveRoleCommand(snapshot.revision, 'ACCEPT')
          : advanceCommand(snapshot.revision);
      const advanced = runSimulate(snapshot, command);
      if (!advanced.ok) throw new Error(`진행 실패: ${advanced.error.code} ${advanced.error.message}`);
      snapshot = advanced.snapshot;
    }
    expect(snapshot.state.pending?.kind).toBe('SETTLEMENT');

    const settled = runSimulate(snapshot, settleSeasonCommand(snapshot.revision));
    if (!settled.ok) throw new Error(`실패: ${settled.error.code} ${settled.error.message}`);
    expect(settled.nextAction).toBe('DECISION');
  });
});
