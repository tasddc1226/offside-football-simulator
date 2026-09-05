import { describe, it, expect } from 'vitest';
import { careerIntegrationFixture, rulesetProto } from './__fixtures__/career-13-integration.js';
import { simulate, type Command } from './simulate.js';
import type { DomainSnapshot, SimulationMode } from './types.js';

// packages/domain은 "pure"(zero 런타임 의존성) tsconfig(`types: []`)를 써서 `@types/node`의
// 전역 `console` 타입이 없다 — vitest(Node) 실행 환경에는 실제로 존재하므로, 타입만 이 파일
// 범위에서 최소로 선언한다(ADR 성격의 domain 순수성 제약을 건드리지 않기 위한 로컬 워크어라운드).
declare const console: { info: (...args: unknown[]) => void };

/**
 * T-4-006 §3: RULE-TIME-004 결정 예산 측정. career-13 seed sweep(§2와 같은 200개 고정 seed)을
 * FAST·CHAPTER 각각으로 한 시즌씩 재생하며 시즌당 사용자 결정 수·핵심 경기 챕터 수·챕터당 판단 수·
 * 강제 사건(INJURY) 수를 센다. 상한 초과는 실패 테스트가 아니라 "콘텐츠 예산 관찰"로만 보고한다
 * (콘텐츠·룰셋은 고치지 않는다). 측정 코드는 이 파일(*.test.ts) 안에 있고 결과는 console.info
 * 표로 남긴다(PR 본문에 옮긴다).
 *
 * 방법론 한계(PR 본문에도 기록): domain `simulate()`는 CHAPTER 후보(`chapterCandidates`)를
 * 호출자가 골라 넣는 순수 함수라 실제 콘텐츠 팩의 트리거·가중치 배치 알고리즘(캘린더 슬롯에 맞는
 * 실제 챕터를 고르는 로직)은 이 파일 범위 밖(웹·API 계층)이다. 여기서는 항상 사용 가능한
 * TAG 트리거 후보 하나(챕터 1개, 판단 1개)만 공급해 "챕터가 열릴 수 있을 때 열린다"를 대략
 * 재현한다 — 그래서 "챕터당 판단 수"는 이 측정에서 상수 1이고, "핵심 경기 챕터 수"는 실제 콘텐츠
 * 배치보다 낮게 잡힐 수 있다(과소추정 방향).
 */

const SWEEP_SEEDS: readonly string[] = Array.from({ length: 200 }, (_, i) => `car13-budget-sweep-${i + 1}`);

// TAG 트리거는 chargen이 항상 붙이는 태그를 쓴다(career-01 EVT-CON-003 B1 outcome).
const ALWAYS_TAG_CHAPTER_CANDIDATE = {
  chapterId: 'CHP-BUDGET-PROBE',
  version: 1,
  importance: 'MAJOR' as const,
  trigger: { kind: 'TAG' as const, tag: '입단테스트_완료' },
  weight: 100,
  decisionsTotal: 1,
};

type SeasonBudget = {
  decisions: number;
  chapters: number;
  decisionsPerChapterSum: number;
  forcedInjury: number;
};

type Cmd = Command & { commandId: string; expectedRevision: number };

function send(snapshot: DomainSnapshot, seq: number, seed: string, type: Command['type'], payload: unknown) {
  const command = { type, commandId: `${seed}-${seq}`, expectedRevision: snapshot.revision, payload } as Cmd;
  const result = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: careerIntegrationFixture.rulesetVersion,
    contentPackVersion: careerIntegrationFixture.contentPackVersion,
  });
  if (!result.ok) throw new Error(`${type} 실패: ${result.error.code} ${result.error.message}`);
  return result;
}

function runChargen(seed: string): { snapshot: DomainSnapshot; seq: number } {
  const createCommand = {
    type: 'CREATE_CAREER',
    commandId: `${seed}-0`,
    expectedRevision: 0,
    payload: {
      careerId: `budget-${seed}`,
      seed,
      simulationMode: 'FAST' as SimulationMode,
      rulesetVersion: careerIntegrationFixture.rulesetVersion,
      contentPackVersion: careerIntegrationFixture.contentPackVersion,
    },
  } as Cmd;
  const created = simulate({ snapshot: null, command: createCommand, ruleset: rulesetProto, rulesetVersion: careerIntegrationFixture.rulesetVersion, contentPackVersion: careerIntegrationFixture.contentPackVersion });
  if (!created.ok) throw new Error('CREATE_CAREER 실패');
  let snapshot = created.snapshot;
  let seq = 0;
  const step = (type: Command['type'], payload: unknown) => {
    seq += 1;
    snapshot = send(snapshot, seq, seed, type, payload).snapshot;
  };
  step('UPDATE_PLAYER_DRAFT', { draft: { name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' } });
  step('UPDATE_PLAYER_DRAFT', { draft: { position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' } });
  step('CONFIRM_PLAYER', {});
  step('ADVANCE', { eligibleEvents: [{ eventId: 'EVT-CON-002', version: 1, weight: 10 }] });
  step('RESOLVE_EVENT', {
    eventId: 'EVT-CON-002',
    definitionVersion: 1,
    choiceId: 'A',
    outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [], addTags: ['진로_입단테스트'] }],
  });
  step('ADVANCE', { eligibleEvents: [{ eventId: 'EVT-CON-003', version: 1, weight: 10 }] });
  step('RESOLVE_EVENT', {
    eventId: 'EVT-CON-003',
    definitionVersion: 1,
    choiceId: 'B',
    outcomes: [
      { id: 'B1', kind: 'SUCCESS', weight: 85, effects: [], addTags: ['입단테스트_완료', '테스트_성공'] },
      { id: 'B2', kind: 'NEUTRAL', weight: 15, effects: [], addTags: ['입단테스트_완료', '테스트_보통'] },
    ],
  });
  step('ADVANCE', { eligibleEvents: [] });
  step('ACCEPT_OFFER', { offerId: 'OFR-9-0' });
  return { snapshot, seq };
}

/** 한 시즌(START_SEASON..SETTLE_SEASON)을 지정한 모드로 재생하며 결정 예산을 센다. 실패하면 null. */
function driveOneSeasonAndMeasure(afterChargen: DomainSnapshot, seq0: number, seed: string, mode: SimulationMode): SeasonBudget | null {
  let seq = seq0;
  let snapshot = afterChargen;
  const budget: SeasonBudget = { decisions: 0, chapters: 0, decisionsPerChapterSum: 0, forcedInjury: 0 };
  try {
    seq += 1;
    snapshot = send(snapshot, seq, seed, 'START_SEASON', { simulationMode: mode, serviceSeasonId: `budget-${mode}` }).snapshot;
    seq += 1;
    let result = send(snapshot, seq, seed, 'RESOLVE_ROLE', { decision: 'ACCEPT' });
    snapshot = result.snapshot;
    budget.decisions += 1;

    for (let guard = 0; guard < 40; guard++) {
      seq += 1;
      result = send(snapshot, seq, seed, 'ADVANCE', { eligibleEvents: [], chapterCandidates: [ALWAYS_TAG_CHAPTER_CANDIDATE] });
      snapshot = result.snapshot;
      if (result.nextAction === 'SETTLEMENT') break;
      if (result.nextAction === 'ADVANCE') continue;

      const pending = snapshot.state.pending;
      if (pending === null) return null;
      if (pending.kind === 'INJURY') {
        seq += 1;
        result = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
          eventId: 'EVT-INJ-001',
          definitionVersion: 1,
          choiceId: 'A',
          rehabPlan: 'STANDARD',
          outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
        });
        snapshot = result.snapshot;
        budget.decisions += 1;
        budget.forcedInjury += 1;
        continue;
      }
      if (pending.kind === 'NATIONAL_TEAM') {
        seq += 1;
        result = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
          eventId: 'EVT-NAT-001',
          definitionVersion: 1,
          choiceId: 'C',
          callUp: 'DECLINE',
          outcomes: [{ id: 'C1', kind: 'FIXED', weight: 100, effects: [] }],
        });
        snapshot = result.snapshot;
        budget.decisions += 1;
        continue;
      }
      if (pending.kind === 'EVENT') {
        seq += 1;
        result = send(snapshot, seq, seed, 'RESOLVE_EVENT', {
          eventId: 'EVT-MEDIA-010',
          definitionVersion: 1,
          choiceId: 'A',
          outcomes: [{ id: 'A1', kind: 'SUCCESS', weight: 100, effects: [] }],
        });
        snapshot = result.snapshot;
        budget.decisions += 1;
        continue;
      }
      if (pending.kind === 'CHAPTER') {
        seq += 1;
        result = send(snapshot, seq, seed, 'RESOLVE_CHAPTER', {
          chapterId: 'CHP-BUDGET-PROBE',
          definitionVersion: 1,
          decisionId: 'D1',
          optionId: 'STEADY',
          outcomes: [{ id: 'STEADY-1', kind: 'FIXED', weight: 100, effects: [], ratingDeltaTenths: 0 }],
        });
        snapshot = result.snapshot;
        budget.decisions += 1; // 브리프 §3: 챕터는 1회 = 결정 1회(내부 판단 수와 무관)
        budget.chapters += 1;
        budget.decisionsPerChapterSum += 1; // ALWAYS_TAG_CHAPTER_CANDIDATE.decisionsTotal === 1
        continue;
      }
      if (pending.kind === 'CONTRACT') {
        seq += 1;
        result = send(snapshot, seq, seed, 'REJECT_OFFER', { offerId: null });
        snapshot = result.snapshot;
        budget.decisions += 1;
        continue;
      }
      return null;
    }
    return budget;
  } catch {
    return null;
  }
}

type Stat = { min: number; max: number; sum: number; count: number };
function stat(): Stat {
  return { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 };
}
function feed(s: Stat, value: number): void {
  s.min = Math.min(s.min, value);
  s.max = Math.max(s.max, value);
  s.sum += value;
  s.count += 1;
}
function avg(s: Stat): number {
  return s.count === 0 ? 0 : s.sum / s.count;
}

describe('RULE-TIME-004 결정 예산 측정(T-4-006 §3)', () => {
  it.each(['FAST', 'CHAPTER'] as const)('%s 모드: 200-seed sweep으로 시즌당 결정 수·챕터 수·강제 사건 수를 잰다', (mode) => {
    const decisionsStat = stat();
    const chaptersStat = stat();
    const decisionsPerChapterStat = stat();
    const forcedStat = stat();
    let samples = 0;
    let decisionsCapExceeded = 0;
    let chaptersCapExceeded = 0;
    let decisionsPerChapterCapExceeded = 0;
    let forcedCapExceeded = 0;

    const DECISIONS_CAP = mode === 'CHAPTER' ? 10 : 6;
    const CHAPTERS_CAP = 4;
    const DECISIONS_PER_CHAPTER_CAP = 3;
    const FORCED_CAP = 2;

    for (const seed of SWEEP_SEEDS) {
      try {
        const { snapshot, seq } = runChargen(seed);
        const budget = driveOneSeasonAndMeasure(snapshot, seq, seed, mode);
        if (budget === null) continue;
        samples += 1;
        feed(decisionsStat, budget.decisions);
        feed(chaptersStat, budget.chapters);
        if (budget.chapters > 0) feed(decisionsPerChapterStat, budget.decisionsPerChapterSum / budget.chapters);
        feed(forcedStat, budget.forcedInjury);
        if (budget.decisions > DECISIONS_CAP) decisionsCapExceeded += 1;
        if (budget.chapters > CHAPTERS_CAP) chaptersCapExceeded += 1;
        if (budget.chapters > 0 && budget.decisionsPerChapterSum / budget.chapters > DECISIONS_PER_CHAPTER_CAP) decisionsPerChapterCapExceeded += 1;
        if (budget.forcedInjury > FORCED_CAP) forcedCapExceeded += 1;
      } catch {
        continue;
      }
    }

    const table = {
      mode,
      samples,
      decisions: { avg: Number(avg(decisionsStat).toFixed(2)), min: decisionsStat.min, max: decisionsStat.max, cap: DECISIONS_CAP, pctExceedingCap: samples === 0 ? 0 : Number(((decisionsCapExceeded / samples) * 100).toFixed(1)) },
      keyMatchChapters: { avg: Number(avg(chaptersStat).toFixed(2)), min: chaptersStat.min, max: chaptersStat.max, cap: CHAPTERS_CAP, pctExceedingCap: samples === 0 ? 0 : Number(((chaptersCapExceeded / samples) * 100).toFixed(1)) },
      decisionsPerChapter: { avg: Number(avg(decisionsPerChapterStat).toFixed(2)), min: decisionsPerChapterStat.count === 0 ? 0 : decisionsPerChapterStat.min, max: decisionsPerChapterStat.count === 0 ? 0 : decisionsPerChapterStat.max, cap: DECISIONS_PER_CHAPTER_CAP, pctExceedingCap: samples === 0 ? 0 : Number(((decisionsPerChapterCapExceeded / samples) * 100).toFixed(1)) },
      forcedEvents: { avg: Number(avg(forcedStat).toFixed(2)), min: forcedStat.min, max: forcedStat.max, cap: FORCED_CAP, pctExceedingCap: samples === 0 ? 0 : Number(((forcedCapExceeded / samples) * 100).toFixed(1)) },
    };
    console.info(`RULE_TIME_004_BUDGET_${mode}`, JSON.stringify(table, null, 2));
    // 상한 초과는 실패 조건이 아니다("콘텐츠 예산 관찰"로만 보고, 브리프 §3) — 표본이 나왔는지만 확인한다.
    expect(samples).toBeGreaterThan(0);
  }, 30000);
});
