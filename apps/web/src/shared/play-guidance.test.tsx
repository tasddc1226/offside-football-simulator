// 이슈 163·164·166 플레이 안내: 저장된 결산·부상 이력만 읽는 순수 파생과 카드 렌더 1케이스.
import { cleanup, render, screen } from '@testing-library/react';
import type { EventDefinition } from '@offside/content';
import type { CareerState, InjuryEpisode, SeasonResult, SeasonSummary } from '@offside/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { InjuryContext } from '../routes/-phase4/injury.js';
import type { NarrativeTokenValues } from './narrative.js';
import {
  GuidanceCard,
  injuryRecurrenceNotice,
  potentialCapNotice,
  retirementEvidenceText,
  retirementPressureNotice,
} from './play-guidance.js';

afterEach(cleanup);

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 22,
    currentStep: 0,
    seasonPhase: 'PRESEASON',
    simulationMode: 'FAST',
    attributes: {} as CareerState['attributes'],
    growthCarryCenti: {} as CareerState['growthCarryCenti'],
    state: { form: 55, fitness: 100, morale: 50 },
    context: { tacticalFit: 12, squadStatus: 0, positionProficiency: 0 },
    relationships: { managerTrust: 8, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT', position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'LEFT',
        preferredPosition: 'W',
        primaryPosition: 'W',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 70,
        scoutedPotentialMin: 60,
        scoutedPotentialMax: 75,
        baseOvr: 61,
      },
    },
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
    nationalityRuleState: { moduleId: 'DEFAULT', exceptions: [] },
    nationalTeam: { callUps: [], debuted: false, pendingDebut: null },
    health: { episodes: [] },
    relationshipLog: [],
    memoryTags: { managerTrust: [], captain: [], rival: [], fans: [], agent: [] },
    reputation: { popularityCenti: 5000, mediaCenti: 5000 },
    ...overrides,
  };
}

function settledSeason(input: {
  attributeDeltas: SeasonResult['attributeDeltas'];
  minutes?: number;
  possibleMinutes?: number;
  injuryMissedMatches?: number;
}): SeasonSummary {
  const minutes = input.minutes ?? 900;
  const possibleMinutes = input.possibleMinutes ?? 1000;
  const result: SeasonResult = {
    index: 3,
    simulationMode: 'FAST',
    teamId: 'team-1',
    managerId: 'mgr-1',
    captaincyAtEnd: 'NONE',
    competitions: [],
    playerStats: {
      group: 'FW',
      appearances: { total: 10, started: 9, sub: 1, zeroMinute: 0, out: 0 },
      minutes,
      ratingSumTenths: 650,
      ratedMatches: 10,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals: { group: 'FW', goals: 3, assists: 1, xgCenti: 250, shots: 20, offsides: 2 },
    },
    selectionSummary: {
      squadRoleAtStart: 'STARTER',
      squadRoleAtEnd: 'STARTER',
      started: 9,
      sub: 1,
      zeroMinute: 0,
      out: 0,
      minutes,
      possibleMinutes,
      finalRank: 1,
    },
    roleChanges: [],
    promiseFulfilment: { promised: 'STARTER', delivered: 'STARTER', fulfilled: true, minutesShareBp: 9000 },
    attributeDeltas: input.attributeDeltas,
    baseOvr: { before: 61, after: 61 },
    stateDeltas: {
      form: { before: 55, after: 55 },
      fitness: { before: 90, after: 90 },
      morale: { before: 50, after: 50 },
      managerTrust: { before: 8, after: 8 },
    },
    chapters: [],
    stepSummaries: [],
    hash: 'hash',
    ...(input.injuryMissedMatches === undefined
      ? {}
      : {
          legacy: {
            policyVersion: '1.0.0' as const,
            incomeMinor: 0,
            contractId: 'con-1',
            relationships: { managerTrust: 8, captain: 0, rival: 0, fans: 0, agent: 0 },
            promotion: false,
            ageAtStart: 22,
            injuryMissedMatches: input.injuryMissedMatches,
          },
        }),
  };
  return { index: 3, simulationMode: 'FAST', teamId: 'team-1', competitions: [], settledAtRevision: 40, result };
}

describe('potentialCapNotice (이슈 163)', () => {
  it('직전 결산에 POTENTIAL_CAP 원인이 있는 능력만 모은다', () => {
    const state = baseState({
      seasonHistory: [
        settledSeason({
          attributeDeltas: [
            { key: 'shooting', delta: 0, causes: [{ cause: 'TRAINING', centi: 100 }, { cause: 'POTENTIAL_CAP', centi: -100 }] },
            { key: 'passing', delta: 1, causes: [{ cause: 'TRAINING', centi: 100 }] },
          ],
        }),
      ],
    });
    expect(potentialCapNotice(state)).toEqual({ seasonNumber: 3, attributeKeys: ['shooting'] });
  });

  it('결산이 없거나 잠재력 상한 원인이 없으면 null', () => {
    expect(potentialCapNotice(baseState({}))).toBeNull();
    const noCap = baseState({
      seasonHistory: [settledSeason({ attributeDeltas: [{ key: 'passing', delta: 1, causes: [{ cause: 'TRAINING', centi: 100 }] }] })],
    });
    expect(potentialCapNotice(noCap)).toBeNull();
  });
});

describe('injuryRecurrenceNotice (이슈 164)', () => {
  const episode = (overrides: Partial<InjuryEpisode>): InjuryEpisode => ({
    id: 'INJ-1-3-1',
    severity: 'MINOR',
    bodyPart: 'KNEE',
    occurredAt: { seasonIndex: 1, step: 3, matchId: 'm1' },
    diagnosisRange: { minMatches: 1, maxMatches: 2 },
    rehab: 'STANDARD',
    recurrenceRiskBp: 1200,
    recurrenceChecksRemaining: 0,
    status: 'RECOVERED',
    permanentDelta: null,
    ...overrides,
  });

  it('직전 같은 부위 RECURRED 에피소드가 있으면 재발 사슬·심각도·위험을 돌려준다', () => {
    const episodes = [
      episode({ id: 'INJ-1-3-1', status: 'RECURRED', severity: 'MINOR' }),
      episode({ id: 'INJ-1-6-1', status: 'REHAB', severity: 'MODERATE', recurrenceRiskBp: 1800, remainingMatches: 3 }),
    ];
    expect(injuryRecurrenceNotice(episodes, 'INJ-1-6-1')).toEqual({
      bodyPart: 'KNEE',
      chainLength: 1,
      priorSeverity: 'MINOR',
      severity: 'MODERATE',
      recurrenceRiskBp: 1800,
    });
  });

  it('부위가 다르거나 이전 부상이 회복 완료면 재발이 아니다', () => {
    const episodes = [
      episode({ id: 'INJ-1-3-1', status: 'RECOVERED' }),
      episode({ id: 'INJ-1-6-1', status: 'REHAB', bodyPart: 'ANKLE' }),
    ];
    expect(injuryRecurrenceNotice(episodes, 'INJ-1-6-1')).toBeNull();
    expect(injuryRecurrenceNotice(episodes, 'missing')).toBeNull();
  });

  it('같은 부위 RECURRED가 연달아 2개면 사슬 길이 2를 돌려준다(도메인 recurrenceChainLength와 같은 셈)', () => {
    const episodes = [
      episode({ id: 'INJ-1-3-1', status: 'RECURRED', severity: 'MINOR' }),
      episode({ id: 'INJ-1-6-1', status: 'RECURRED', severity: 'MODERATE' }),
      episode({ id: 'INJ-1-9-1', status: 'REHAB', severity: 'MAJOR', recurrenceRiskBp: 1500, remainingMatches: 8 }),
    ];
    expect(injuryRecurrenceNotice(episodes, 'INJ-1-9-1')).toEqual({
      bodyPart: 'KNEE',
      chainLength: 2,
      priorSeverity: 'MODERATE',
      severity: 'MAJOR',
      recurrenceRiskBp: 1500,
    });
  });

  // 룰셋 1.3.0은 recurrenceMaxChain=2 — 도메인은 사슬 길이가 상한 미만인 회복 에피소드만 재발 판정을
  // 돌리므로(simulate.ts) 화면 문장도 상한 도달 여부로 갈라져야 한다.
  const injuryState = (episodes: InjuryEpisode[], rulesetVersion: string): CareerState =>
    baseState({
      rulesetVersion,
      health: { episodes },
      pending: { kind: 'INJURY', step: 9, episodeId: episodes.at(-1)!.id, eventId: 'injury.v1', version: 1 },
    });
  const renderInjury = (state: CareerState) =>
    render(<InjuryContext state={state} definition={{} as EventDefinition} tokens={{} as NarrativeTokenValues} />);

  it('재발 사슬이 상한(recurrenceMaxChain)에 닿으면 회복 뒤 재발 판정을 더 하지 않는다고 안내한다', () => {
    const state = injuryState(
      [
        episode({ id: 'INJ-1-3-1', status: 'RECURRED' }),
        episode({ id: 'INJ-1-6-1', status: 'RECURRED' }),
        episode({ id: 'INJ-1-9-1', status: 'REHAB', severity: 'MODERATE', remainingMatches: 3 }),
      ],
      '1.3.0',
    );
    renderInjury(state);
    const notice = screen.getByTestId('injury-recurrence');
    expect(notice).toHaveTextContent('같은 부위 재발 2회째');
    expect(notice).toHaveTextContent('같은 부위 재발이 상한(2회)에 닿아 회복 뒤 재발 판정은 더 하지 않습니다.');
    expect(notice).not.toHaveTextContent('경기 동안 재발 판정을 다시 받습니다');
    expect(notice).not.toHaveTextContent('누적 재발 위험');
  });

  it('재발 사슬이 상한 미만이면 회복 뒤 재발 창(recurrenceWindowMatches) 안내를 유지한다', () => {
    const state = injuryState(
      [
        episode({ id: 'INJ-1-3-1', status: 'RECURRED' }),
        episode({ id: 'INJ-1-6-1', status: 'REHAB', severity: 'MODERATE', remainingMatches: 3 }),
      ],
      '1.3.0',
    );
    renderInjury(state);
    const notice = screen.getByTestId('injury-recurrence');
    expect(notice).toHaveTextContent('같은 부위 재발 1회째');
    expect(notice).toHaveTextContent('회복 뒤 6경기 동안 재발 판정을 다시 받습니다.');
    expect(notice).not.toHaveTextContent('상한');
  });
});

describe('retirementPressureNotice (이슈 166)', () => {
  it('압력 40 이상이면 값·상태·직전 결산 연령 하락 근거를 돌려준다', () => {
    const state = baseState({
      age: 34,
      state: { form: 55, fitness: 50, morale: 50 },
      retirement: { policyVersion: '1.0.0', marketOffers: 0, lastChanceConsumed: false, lastChanceSeasonIndex: null },
      seasonHistory: [
        settledSeason({
          minutes: 0,
          possibleMinutes: 1000,
          injuryMissedMatches: 0,
          attributeDeltas: [
            { key: 'shooting', delta: -1, causes: [{ cause: 'AGE_DECLINE', centi: -100 }] },
            { key: 'pace', delta: -2, causes: [{ cause: 'AGE_DECLINE', centi: -200 }] },
          ],
        }),
      ],
    });
    const notice = retirementPressureNotice(state);
    expect(notice).not.toBeNull();
    expect(notice!.total).toBeGreaterThanOrEqual(40);
    expect(notice!.status).toBe('REVIEW');
    expect(notice!.ageDeclineCenti).toBe(-300);
    expect(notice!.groupDeclines).toEqual([
      { id: 'TECHNICAL', centi: -100 },
      { id: 'PHYSICAL', centi: -200 },
    ]);
    expect(retirementEvidenceText(notice!)).toBe('연령 -3.0 · 기술 -1.0 · 신체 -2.0');
  });

  it('압력이 낮거나 결산이 없으면 null', () => {
    expect(retirementPressureNotice(baseState({}))).toBeNull();
    const low = baseState({
      contract: {
        id: 'con-1',
        offerId: 'ofr-1',
        teamId: 'team-1',
        teamName: '팀',
        leagueTier: 1,
        lengthSeasons: 3,
        wageMinorPerWeek: 1,
        signingBonusMinor: 0,
        rolePromise: 'STARTER',
        shirtNumber: 7,
        signatureType: 'AUTO',
        signedAtRevision: 1,
        kind: 'PERMANENT',
        appearancePromise: { minutesShareBp: 7000 },
        positionPlan: 'W',
        suspended: false,
        loan: null,
        promiseBreaches: 0,
        signedSeasonIndex: 1,
      },
      seasonHistory: [settledSeason({ minutes: 1000, possibleMinutes: 1000, injuryMissedMatches: 0, attributeDeltas: [] })],
    });
    expect(retirementPressureNotice(low)).toBeNull();
  });
});

describe('GuidanceCard', () => {
  it('라벨을 접근 가능한 이름으로 갖는 note로 렌더하고 본문·근거를 보여준다', () => {
    render(
      <GuidanceCard label="잠재력 상한 안내" detail="시즌 3 결산 기준">
        지난 시즌 슈팅은(는) 잠재력 상한에 막혀 성장이 멈췄어요
      </GuidanceCard>,
    );
    const note = screen.getByRole('note', { name: '잠재력 상한 안내' });
    expect(note).toHaveTextContent('지난 시즌 슈팅은(는) 잠재력 상한에 막혀 성장이 멈췄어요');
    expect(note).toHaveTextContent('시즌 3 결산 기준');
  });
});
