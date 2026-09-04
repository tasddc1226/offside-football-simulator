import { describe, expect, it } from 'vitest';
import { CAREER_TAGS, CAREER_TAG_EVALUATORS, CAREER_TAG_IDS, evaluateCareerTags, grantCareerTag } from './career-tags.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { seedRng } from './rng.js';
import { initialSeasonPlayerStats } from './season-stats.js';
import {
  statGroupOf,
  type CareerState,
  type CareerTagId,
  type ChapterRecord,
  type ClubStint,
  type FootballSeason,
  type SeasonResult,
  type SeasonSummary,
} from './types.js';
import { simulate } from './simulate.js';

// 14 "커리어 태그 카탈로그" 표(라벨·희귀도) 그대로 — CAREER_TAGS가 정확히 이 값을 담고 있는지 고정한다.
const CATALOG_TABLE: Record<CareerTagId, { label: string; rarity: 'COMMON' | 'RARE' | 'EPIC' }> = {
  'TAG-ONE-CLUB': { label: '원클럽맨', rarity: 'RARE' },
  'TAG-JOURNEYMAN': { label: '저니맨', rarity: 'COMMON' },
  'TAG-LOAN-LEGEND': { label: '임대 신화', rarity: 'RARE' },
  'TAG-BIG-GAME': { label: '빅게임 플레이어', rarity: 'RARE' },
  'TAG-GLASS-GENIUS': { label: '유리몸 천재', rarity: 'RARE' },
  'TAG-MANAGER-FAVOURITE': { label: '감독의 애제자', rarity: 'COMMON' },
  'TAG-LOCKER-LEADER': { label: '라커룸 리더', rarity: 'RARE' },
  'TAG-PROMOTION-EXPERT': { label: '승격 전문가', rarity: 'RARE' },
  'TAG-DERBY-HERO': { label: '더비의 영웅', rarity: 'RARE' },
  'TAG-TRAITOR': { label: '배신자', rarity: 'COMMON' },
  'TAG-LATE-BLOOMER': { label: '대기만성', rarity: 'RARE' },
  'TAG-IRONMAN': { label: '철인', rarity: 'EPIC' },
  'TAG-COMEBACK': { label: '컴백', rarity: 'RARE' },
  'TAG-MENTOR': { label: '멘토', rarity: 'COMMON' },
  'TAG-CONTROVERSIAL': { label: '논란의 인물', rarity: 'COMMON' },
  'TAG-UNCROWNED': { label: '무관', rarity: 'RARE' },
};

describe('CAREER_TAGS 카탈로그', () => {
  it('16종이고, 14 문서 표의 라벨·희귀도와 정확히 같다', () => {
    expect(CAREER_TAG_IDS).toHaveLength(16);
    for (const tagId of CAREER_TAG_IDS) {
      expect(CAREER_TAGS[tagId].label).toBe(CATALOG_TABLE[tagId].label);
      expect(CAREER_TAGS[tagId].rarity).toBe(CATALOG_TABLE[tagId].rarity);
    }
  });

  it('CAREER_TAG_EVALUATORS에 등록된 태그는 모두 evaluateAt: SEASON_SETTLED다', () => {
    for (const tagId of Object.keys(CAREER_TAG_EVALUATORS) as CareerTagId[]) {
      expect(CAREER_TAGS[tagId].evaluateAt).toBe('SEASON_SETTLED');
    }
  });
});

function baseCareerTagState(): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_tag_test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 20,
    currentStep: 1,
    seasonPhase: 'PRESEASON',
    simulationMode: 'FAST',
    attributes: {
      shooting: 60, passing: 60, dribbling: 60, tackling: 60, firstTouch: 60, crossing: 60, goalkeeping: 10,
      pace: 60, acceleration: 60, agility: 60, jumping: 60, stamina: 60, strength: 60, durability: 60,
      decisions: 60, concentration: 60, composure: 60, positioning: 60, leadership: 60, consistency: 60,
    },
    growthCarryCenti: {
      shooting: 0, passing: 0, dribbling: 0, tackling: 0, firstTouch: 0, crossing: 0, goalkeeping: 0,
      pace: 0, acceleration: 0, agility: 0, jumping: 0, stamina: 0, strength: 0, durability: 0,
      decisions: 0, concentration: 0, composure: 0, positioning: 0, leadership: 0, consistency: 0,
    },
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 50, squadStatus: 50, positionProficiency: 100 },
    relationships: { managerTrust: 50, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    careerTags: [],
    careerTagGrants: [],
    rngState: seedRng('career-tags-test'),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: null,
    contract: null,
    parentContract: null,
    clubHistory: [],
    timeline: [],
    season: null,
    seasonHistory: [],
  };
}

function chapterDecision(outcomeKind: 'SUCCESS' | 'FAIL'): ChapterRecord['decisions'][number] {
  return { decisionId: 'D1', optionId: 'OPT-A', outcomeId: `OUT-${outcomeKind}`, outcomeKind };
}

function chapterRecord(overrides: Partial<ChapterRecord> & { decisions: ChapterRecord['decisions'] }): ChapterRecord {
  return {
    chapterId: 'CHP-TEST',
    version: 1,
    step: 3,
    matchId: 'm1',
    importance: 'MAJOR',
    trigger: 'DEBUT',
    ratingDeltaTenths: 0,
    ...overrides,
  };
}

const DUMMY_SEASON_RESULT_BASE: Omit<SeasonResult, 'chapters' | 'index'> = {
  simulationMode: 'FAST',
  teamId: 'team-1',
  competitions: [],
  playerStats: {
    group: 'FW',
    appearances: { total: 30, started: 28, sub: 2, zeroMinute: 0, out: 0 },
    minutes: 2520,
    ratingSumTenths: 1800,
    ratedMatches: 28,
    yellow: 2,
    red: 0,
    injuries: 0,
    totals: { group: 'FW', goals: 10, assists: 5, xgCenti: 900, shots: 80, offsides: 4 },
  },
  selectionSummary: {
    squadRoleAtStart: 'STARTER',
    squadRoleAtEnd: 'STARTER',
    started: 28,
    sub: 2,
    zeroMinute: 0,
    out: 0,
    minutes: 2520,
    possibleMinutes: 3060,
    finalRank: 1,
  },
  roleChanges: [],
  promiseFulfilment: { promised: 'STARTER', delivered: 'STARTER', fulfilled: true, minutesShareBp: 8235 },
  attributeDeltas: [],
  baseOvr: { before: 60, after: 61 },
  stateDeltas: {
    form: { before: 50, after: 50 },
    fitness: { before: 80, after: 80 },
    morale: { before: 60, after: 60 },
    managerTrust: { before: 50, after: 50 },
  },
  stepSummaries: [],
  hash: 'dummy-hash',
};

function seasonSummary(index: number, chapters: ChapterRecord[]): SeasonSummary {
  const result: SeasonResult = { ...DUMMY_SEASON_RESULT_BASE, index, chapters };
  return { index, simulationMode: 'FAST', teamId: 'team-1', competitions: [], settledAtRevision: index * 10, result };
}

describe('evaluateCareerTags', () => {
  it('TAG-BIG-GAME: 챕터 SUCCESS 누계 4회는 false, 5회는 true다', () => {
    const fourSuccesses = seasonSummary(1, [
      chapterRecord({ decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS')] }),
      chapterRecord({ decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('FAIL')] }),
    ]);
    const stateWithFour = { ...baseCareerTagState(), seasonHistory: [fourSuccesses] };
    const grantedAtFour = evaluateCareerTags(stateWithFour, fourSuccesses.result, rulesetProto);
    expect(grantedAtFour).not.toContain('TAG-BIG-GAME');

    const fiveSuccesses = seasonSummary(2, [chapterRecord({ decisions: [chapterDecision('SUCCESS')] })]);
    const stateWithFive = { ...baseCareerTagState(), seasonHistory: [fourSuccesses, fiveSuccesses] };
    const grantedAtFive = evaluateCareerTags(stateWithFive, fiveSuccesses.result, rulesetProto);
    expect(grantedAtFive).toContain('TAG-BIG-GAME');
  });

  it('TAG-DERBY-HERO: DERBY 트리거 챕터의 SUCCESS만 세고, 3회 이상이면 부여된다', () => {
    const summary = seasonSummary(1, [
      chapterRecord({ trigger: 'DERBY', decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS')] }),
      chapterRecord({ trigger: 'DEBUT', decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS')] }),
    ]);
    const stateBelow = { ...baseCareerTagState(), seasonHistory: [summary] };
    expect(evaluateCareerTags(stateBelow, summary.result, rulesetProto)).not.toContain('TAG-DERBY-HERO');

    const summaryAtThree = seasonSummary(2, [chapterRecord({ trigger: 'DERBY', decisions: [chapterDecision('SUCCESS')] })]);
    const stateAtThree = { ...baseCareerTagState(), seasonHistory: [summary, summaryAtThree] };
    expect(evaluateCareerTags(stateAtThree, summaryAtThree.result, rulesetProto)).toContain('TAG-DERBY-HERO');
  });

  it('TAG-IRONMAN: 10시즌 미만이면 조건과 무관하게 항상 false다', () => {
    const nineSeasons: SeasonSummary[] = Array.from({ length: 9 }, (_, i) => seasonSummary(i + 1, []));
    const state = { ...baseCareerTagState(), seasonHistory: nineSeasons };
    expect(evaluateCareerTags(state, nineSeasons[8]!.result, rulesetProto)).not.toContain('TAG-IRONMAN');
  });

  it('이미 부여된 태그는 다시 반환하지 않는다', () => {
    const fiveSuccesses = seasonSummary(1, [
      chapterRecord({ decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS')] }),
    ]);
    const alreadyGranted = { ...baseCareerTagState(), seasonHistory: [fiveSuccesses], careerTags: ['TAG-BIG-GAME'] as CareerTagId[] };
    expect(evaluateCareerTags(alreadyGranted, fiveSuccesses.result, rulesetProto)).not.toContain('TAG-BIG-GAME');
  });
});

// T-3-003 D-48: Phase 3 태그 5종 각각 참·거짓 1쌍(ruleset-proto·합성 clubHistory).
describe('evaluateCareerTags — Phase 3 태그 5종', () => {
  function stint(overrides: Partial<ClubStint> & Pick<ClubStint, 'teamId' | 'kind' | 'fromSeasonIndex'>): ClubStint {
    return {
      teamName: overrides.teamId,
      leagueTier: 1,
      toSeasonIndex: null,
      endReason: null,
      contractId: `CTR-${overrides.teamId}-${overrides.fromSeasonIndex}`,
      ...overrides,
    };
  }

  it('TAG-ONE-CLUB: 한 클럽(PERMANENT)에서만 8시즌 이상이면 참, 클럽이 둘이면 거짓이다', () => {
    const history = Array.from({ length: 8 }, (_, i) => seasonSummary(i + 1, []));

    const oneClub = [stint({ teamId: 'seoul-tier1', kind: 'PERMANENT', fromSeasonIndex: 1 })];
    const trueState = { ...baseCareerTagState(), seasonHistory: history, clubHistory: oneClub };
    expect(evaluateCareerTags(trueState, history[7]!.result, rulesetProto)).toContain('TAG-ONE-CLUB');

    const twoClubs = [
      stint({ teamId: 'seoul-tier1', kind: 'PERMANENT', fromSeasonIndex: 1, toSeasonIndex: 4, endReason: 'TRANSFERRED' }),
      stint({ teamId: 'busan-tier2', leagueTier: 2, kind: 'PERMANENT', fromSeasonIndex: 5 }),
    ];
    const falseState = { ...baseCareerTagState(), seasonHistory: history, clubHistory: twoClubs };
    expect(evaluateCareerTags(falseState, history[7]!.result, rulesetProto)).not.toContain('TAG-ONE-CLUB');
  });

  it('TAG-JOURNEYMAN: 서로 다른 클럽(임대 포함) 6곳 이상이면 참, 4곳뿐이면 거짓이다', () => {
    const dummyResult = seasonSummary(1, []).result;

    const sixClubs = Array.from({ length: 6 }, (_, i) =>
      stint({ teamId: `team-${i}`, kind: i % 2 === 0 ? 'PERMANENT' : 'LOAN', fromSeasonIndex: i, toSeasonIndex: i, endReason: 'LOANED' }),
    );
    const trueState = { ...baseCareerTagState(), clubHistory: sixClubs };
    expect(evaluateCareerTags(trueState, dummyResult, rulesetProto)).toContain('TAG-JOURNEYMAN');

    const fourClubs = Array.from({ length: 4 }, (_, i) =>
      stint({ teamId: `team-${i}`, kind: 'PERMANENT', fromSeasonIndex: i, toSeasonIndex: i, endReason: 'TRANSFERRED' }),
    );
    const falseState = { ...baseCareerTagState(), clubHistory: fourClubs };
    expect(evaluateCareerTags(falseState, dummyResult, rulesetProto)).not.toContain('TAG-JOURNEYMAN');
  });

  it('TAG-LOAN-LEGEND: 임대 시즌 출전 비율·평점을 채우고 복귀 다음 시즌 STARTER면 참, STARTER가 아니면 거짓이다', () => {
    const loanSeason: SeasonSummary = {
      index: 1,
      simulationMode: 'FAST',
      teamId: 'busan-tier2',
      competitions: [],
      settledAtRevision: 10,
      result: { ...DUMMY_SEASON_RESULT_BASE, index: 1, chapters: [], playerStats: { ...DUMMY_SEASON_RESULT_BASE.playerStats, ratingSumTenths: 2000 } },
    };
    const loanStint = stint({ teamId: 'busan-tier2', leagueTier: 2, kind: 'LOAN', fromSeasonIndex: 1, toSeasonIndex: 1, endReason: 'RETURNED' });
    const parentStint = stint({ teamId: 'seoul-tier1', kind: 'PERMANENT', fromSeasonIndex: 2 });

    const starterReturnSeason: SeasonSummary = {
      index: 2,
      simulationMode: 'FAST',
      teamId: 'seoul-tier1',
      competitions: [],
      settledAtRevision: 20,
      result: { ...DUMMY_SEASON_RESULT_BASE, index: 2, chapters: [], selectionSummary: { ...DUMMY_SEASON_RESULT_BASE.selectionSummary, squadRoleAtEnd: 'STARTER' } },
    };
    const trueState = {
      ...baseCareerTagState(),
      seasonHistory: [loanSeason, starterReturnSeason],
      clubHistory: [loanStint, parentStint],
    };
    expect(evaluateCareerTags(trueState, starterReturnSeason.result, rulesetProto)).toContain('TAG-LOAN-LEGEND');

    const rotationReturnSeason: SeasonSummary = {
      ...starterReturnSeason,
      result: { ...starterReturnSeason.result, selectionSummary: { ...starterReturnSeason.result.selectionSummary, squadRoleAtEnd: 'ROTATION' } },
    };
    const falseState = {
      ...baseCareerTagState(),
      seasonHistory: [loanSeason, rotationReturnSeason],
      clubHistory: [loanStint, parentStint],
    };
    expect(evaluateCareerTags(falseState, rotationReturnSeason.result, rulesetProto)).not.toContain('TAG-LOAN-LEGEND');
  });

  it('TAG-PROMOTION-EXPERT: 승격권 순위·STARTER 시즌이 2회면 참, 1회면 거짓이다', () => {
    function promotionSeason(index: number, finalRank: number, squadRoleAtEnd: SeasonResult['selectionSummary']['squadRoleAtEnd']): SeasonSummary {
      return {
        index,
        simulationMode: 'FAST',
        teamId: 'busan-tier2', // league-tier2, promotionSlots 2
        competitions: [],
        settledAtRevision: index * 10,
        result: {
          ...DUMMY_SEASON_RESULT_BASE,
          index,
          chapters: [],
          selectionSummary: { ...DUMMY_SEASON_RESULT_BASE.selectionSummary, finalRank, squadRoleAtEnd },
        },
      };
    }

    const twoQualifying = [promotionSeason(1, 2, 'STARTER'), promotionSeason(2, 1, 'STARTER')];
    const trueState = { ...baseCareerTagState(), seasonHistory: twoQualifying };
    expect(evaluateCareerTags(trueState, twoQualifying[1]!.result, rulesetProto)).toContain('TAG-PROMOTION-EXPERT');

    const oneQualifying = [promotionSeason(1, 2, 'STARTER'), promotionSeason(2, 5, 'STARTER')];
    const falseState = { ...baseCareerTagState(), seasonHistory: oneQualifying };
    expect(evaluateCareerTags(falseState, oneQualifying[1]!.result, rulesetProto)).not.toContain('TAG-PROMOTION-EXPERT');
  });

  it('TAG-TRAITOR: 배신_이적 태그·이적 후 첫 시즌·팬 ≤30이면 참, 팬이 30을 넘으면 거짓이다', () => {
    const resultAtIndex3: SeasonResult = { ...DUMMY_SEASON_RESULT_BASE, index: 3, chapters: [] };
    const history: SeasonSummary[] = [
      seasonSummary(1, []),
      seasonSummary(2, []),
      { index: 3, simulationMode: 'FAST', teamId: 'seoul-tier1', competitions: [], settledAtRevision: 30, result: resultAtIndex3 },
    ];
    const currentStint = stint({ teamId: 'seoul-tier1', kind: 'PERMANENT', fromSeasonIndex: 3 });

    const trueState = {
      ...baseCareerTagState(),
      tags: ['배신_이적'],
      relationships: { ...baseCareerTagState().relationships, fans: 20 },
      seasonHistory: history,
      clubHistory: [currentStint],
    };
    expect(evaluateCareerTags(trueState, resultAtIndex3, rulesetProto)).toContain('TAG-TRAITOR');

    const falseState = { ...trueState, relationships: { ...trueState.relationships, fans: 40 } };
    expect(evaluateCareerTags(falseState, resultAtIndex3, rulesetProto)).not.toContain('TAG-TRAITOR');
  });
});

describe('grantCareerTag', () => {
  it('멱등: 이미 있는 태그를 다시 부여해도 무변경이다', () => {
    const state = { ...baseCareerTagState(), careerTags: ['TAG-BIG-GAME'] as CareerTagId[] };
    const source = { seasonIndex: 1, revision: 5, refId: 'SETTLE_SEASON:1' };
    const result = grantCareerTag(state, 'TAG-BIG-GAME', source);
    expect(result).toBe(state);
  });

  it('careerTags는 코드포인트 오름차순으로 정렬된 채 쌓이고, careerTagGrants에 소스가 남는다', () => {
    let state = baseCareerTagState();
    state = grantCareerTag(state, 'TAG-DERBY-HERO', { seasonIndex: 1, revision: 5, refId: 'SETTLE_SEASON:1' });
    state = grantCareerTag(state, 'TAG-BIG-GAME', { seasonIndex: 1, revision: 5, refId: 'SETTLE_SEASON:1' });
    expect(state.careerTags).toEqual(['TAG-BIG-GAME', 'TAG-DERBY-HERO']);
    expect(state.careerTagGrants).toEqual([
      { tagId: 'TAG-DERBY-HERO', seasonIndex: 1, atRevision: 5, sourceRefId: 'SETTLE_SEASON:1' },
      { tagId: 'TAG-BIG-GAME', seasonIndex: 1, atRevision: 5, sourceRefId: 'SETTLE_SEASON:1' },
    ]);
  });
});

// T-2-014 D-42: settleSeason이 evaluateCareerTags → grantCareerTag를 실제로 부르고, 부여마다
// CAREER_TAG_GRANTED 타임라인 항목을 남기는지 simulate() 수준에서 확인한다(순수 함수 단위 테스트만으로는
// settleSeason 배선 자체를 검증할 수 없다).
describe('settleSeason의 커리어 태그 결산 훅', () => {
  function makeMatch(id: string, chapterId: string | null): FootballSeason['matches'][number] {
    return {
      id,
      step: 3,
      order: 1,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponent: { id: 'opp-1', name: 'Opp', strength: 50 },
      home: true,
      result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' },
      appearance: 'START',
      outReason: null,
      minutes: 90,
      involvement: 50,
      stats: { group: 'FW', goals: 1, assists: 0, xgCenti: 30, shots: 3, offsides: 0 },
      ratingTenths: 70,
      cards: { yellow: 0, red: false },
      injuredOff: false,
      chapterId,
    };
  }

  function makeSeason(): FootballSeason {
    return {
      index: 1,
      serviceSeasonId: 'svc-tag-test',
      simulationMode: 'FAST',
      calendarId: 'default',
      currentStep: 12,
      phase: 'SETTLEMENT',
      steps: [],
      teamId: 'team-1',
      styleId: 'style-1',
      squadRole: 'STARTER',
      squadRoleAtStart: 'STARTER',
      trainingFocus: 'ROLE',
      competitions: [],
      schedule: [],
      matches: [makeMatch('m1', null)],
      ageReferenceStep: 1,
      squad: { competitors: [] },
      selection: {
        position: 'ST',
        slots: 1,
        benchSlots: 0,
        candidates: [
          {
            id: 'PLAYER',
            name: '테스트',
            baseOvr: 60,
            tacticalFit: 50,
            managerTrust: 50,
            expectedPerformance: 50,
            squadStatus: 50,
            score: 50,
            excluded: null,
            rank: 1,
            appearance: 'START',
          },
        ],
        playerReason: null,
      },
      playerStats: { ...initialSeasonPlayerStats(statGroupOf('ST')), appearances: { total: 1, started: 1, sub: 0, zeroMinute: 0, out: 0 }, minutes: 90, ratedMatches: 1, ratingSumTenths: 70 },
      availability: null,
      lastRatingTenths: 70,
      yellowSuspensionCount: 0,
      matchRngState: seedRng('career-tags-settle-match'),
      scheduledEffects: [],
      chapters: [],
    };
  }

  function makeSettleableState(): CareerState {
    const priorFiveSuccesses = seasonSummary(1, [
      chapterRecord({
        decisions: [chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS'), chapterDecision('SUCCESS')],
      }),
    ]);
    return {
      ...baseCareerTagState(),
      currentStep: 12,
      seasonPhase: 'SETTLEMENT',
      season: makeSeason(),
      seasonHistory: [priorFiveSuccesses],
      pending: { kind: 'SETTLEMENT', step: 12 },
      timeline: [{ revision: 1, kind: 'SEASON_STARTED', refId: null, age: 20, step: 1 }],
      player: {
        draft: { name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT', position: 'ST', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
        profile: {
          name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT',
          preferredPosition: 'ST', primaryPosition: 'ST', archetypeId: 'inside-forward', backgroundId: 'club-academy',
          truePotential: 75, scoutedPotentialMin: 65, scoutedPotentialMax: 80, baseOvr: 60,
        },
      },
      contract: {
        id: 'CTR-1', offerId: 'OFR-1', teamId: 'team-1', teamName: '테스트 FC', leagueTier: 1,
        lengthSeasons: 3, wageMinorPerWeek: 1000000, signingBonusMinor: 0, rolePromise: 'STARTER',
        shirtNumber: 9, signatureType: 'AUTO', signedAtRevision: 1,
        kind: 'PERMANENT', appearancePromise: { minutesShareBp: 8000 }, positionPlan: 'ST',
        suspended: false, loan: null, promiseBreaches: 0, signedSeasonIndex: 1,
      },
    };
  }

  it('이번 시즌 결산으로 커리어 누적 SUCCESS가 5회를 넘기면 TAG-BIG-GAME이 부여되고 타임라인에 남는다', () => {
    const state = makeSettleableState();
    const snapshot = { revision: 20, checkpoint: 'STEP_BOUNDARY' as const, state, stateHash: 'x', rulesetVersion: '1.0.0', contentPackVersion: '0.1.0' };
    const result = simulate({
      snapshot,
      command: { type: 'SETTLE_SEASON', commandId: 'cmd-settle-tag', expectedRevision: 20, payload: {} },
      ruleset: rulesetProto,
      rulesetVersion: rulesetProto.version,
      contentPackVersion: '0.1.0',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 이번 시즌 chapters는 비어 있어 누계는 이전 시즌의 5 그대로다 — 정확히 경계에서 부여된다.
    expect(result.snapshot.state.careerTags).toContain('TAG-BIG-GAME');
    const grantEntry = result.snapshot.state.timeline.find((entry) => entry.kind === 'CAREER_TAG_GRANTED');
    expect(grantEntry).toMatchObject({ kind: 'CAREER_TAG_GRANTED', refId: 'TAG-BIG-GAME' });
    expect(result.snapshot.state.careerTagGrants).toContainEqual(
      expect.objectContaining({ tagId: 'TAG-BIG-GAME', seasonIndex: 1, sourceRefId: 'SETTLE_SEASON:1' }),
    );
  });
});
