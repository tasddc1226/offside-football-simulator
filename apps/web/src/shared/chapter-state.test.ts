// SCR-031 deriveChapterView 분기 표: pending CHAPTER(진행 중) · 방금 끝난 챕터(CHAPTER_RESOLVED
// 직후) · 그 외(null) 세 갈래와, 정의·기록·팩이 서로 어긋난 방어적 분기를 확인한다. 판단 2개짜리
// 합성 정의를 쓴다(실제 팩 CHP-MATCH-001은 판단 1개뿐이라 진행 인덱스 전이를 보여주지 못한다).
import { describe, expect, it } from 'vitest';
import type { CareerState, ChapterRecord, FootballSeason, MatchRecord } from '@offside/domain';
import type { ChapterDefinition, ContentPack } from '@offside/content';
import { deriveChapterView, deriveNationalTeamResultSummary } from './chapter-state.js';

const DEFINITION: ChapterDefinition = {
  id: 'CHP-TEST-001',
  version: 1,
  importance: 'MAJOR',
  trigger: { kind: 'DEBUT' },
  weight: 100,
  decisions: [
    {
      id: 'D1',
      prompt: '판단 1',
      options: [
        {
          id: 'SAFE',
          label: '안전하게',
          riskLabel: 'LOW',
          priorProbability: { successBp: 7000 },
          previewEffects: [],
          outcomes: [
            {
              id: 'D1-SUCCESS',
              kind: 'SUCCESS',
              weight: 100,
              title: 'D1 성공',
              ratingDeltaTenths: 3,
              effects: [],
              narrative: { situation: '판단 1이 성공했다.' },
            },
          ],
        },
      ],
    },
    {
      id: 'D2',
      prompt: '판단 2',
      options: [
        {
          id: 'BOLD',
          label: '과감하게',
          riskLabel: 'HIGH',
          priorProbability: { successBp: 3500 },
          previewEffects: [],
          outcomes: [
            {
              id: 'D2-FAIL',
              kind: 'FAIL',
              weight: 100,
              title: 'D2 실패',
              ratingDeltaTenths: -5,
              effects: [],
              narrative: { situation: '판단 2가 실패했다.' },
            },
          ],
        },
      ],
    },
  ],
};

const NATIONAL_DEFINITION: ChapterDefinition = {
  ...DEFINITION,
  id: 'CHP-NAT-001',
  trigger: { kind: 'NATIONAL_DEBUT' },
};

const PACK = { chaptersById: new Map([[DEFINITION.id, DEFINITION]]) } as unknown as ContentPack;
const NATIONAL_PACK = { chaptersById: new Map([[NATIONAL_DEFINITION.id, NATIONAL_DEFINITION]]) } as unknown as ContentPack;
const NATIONAL_OPPONENT = { opponentId: 'NATIONAL_OPPONENT_001', opponentName: '노르카니아' };

const MATCH: MatchRecord = {
  id: 'match-1',
  step: 2,
  order: 0,
  competitionId: 'LEAGUE',
  kind: 'LEAGUE',
  round: null,
  opponent: { id: 'rival-fc', name: '라이벌 FC', strength: 80 },
  home: true,
  result: { goalsFor: 2, goalsAgainst: 1, outcome: 'WIN' },
  appearance: 'START',
  outReason: null,
  minutes: 90,
  involvement: 5,
  stats: { group: 'MF', assists: 1, chancesCreated: 2, progressivePasses: 3, passesAttempted: 40, passesCompleted: 32, ballRecoveries: 4 },
  ratingTenths: 72,
  cards: { yellow: 0, red: false },
  injuredOff: false,
  chapterId: DEFINITION.id,
};

function seasonWith(overrides: Partial<FootballSeason>): FootballSeason {
  return { matches: [MATCH], chapters: [], ...overrides } as unknown as FootballSeason;
}

function baseState(overrides: Partial<CareerState>): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 17,
    currentStep: 2,
    seasonPhase: 'LEAGUE',
    simulationMode: 'CHAPTER',
    attributes: {} as CareerState['attributes'],
    growthCarryCenti: {} as CareerState['growthCarryCenti'],
    state: { form: 50, fitness: 100, morale: 50 },
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
    rngState: { s: [1, 2, 3, 4], draws: 0 },
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT', position: 'CM', archetypeId: 'inside-forward', backgroundId: 'club-academy' },
      profile: {
        name: '김서준',
        gender: 'UNSPECIFIED',
        nationalityCode: 'KR',
        preferredFoot: 'LEFT',
        primaryPosition: 'CM',
        preferredPosition: 'CM',
        archetypeId: 'inside-forward',
        backgroundId: 'club-academy',
        truePotential: 70,
        scoutedPotentialMin: 60,
        scoutedPotentialMax: 80,
        baseOvr: 60,
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

describe('deriveChapterView', () => {
  it('pending CHAPTER면 진행 중 뷰를 만든다(아직 확정된 판단 없음: currentDecisionIndex 0)', () => {
    const state = baseState({
      pending: { kind: 'CHAPTER', step: 2, chapterId: DEFINITION.id, version: 1, importance: 'MAJOR', trigger: 'DEBUT', matchId: MATCH.id, decisionsTotal: 2, resolved: [] },
      season: seasonWith({}),
    });

    const view = deriveChapterView(state, PACK);

    expect(view).not.toBeNull();
    expect(view?.completed).toBe(false);
    expect(view?.decisionsTotal).toBe(2);
    expect(view?.currentDecisionIndex).toBe(0);
    expect(view?.resolved).toEqual([]);
    expect(view?.chapterRecord).toBeNull();
    expect(view?.match).toEqual(MATCH);
    expect(view?.context).toEqual({ kind: 'CLUB', competition: 'LEAGUE', opponent: MATCH.opponent, home: true });
  });

  it('pending NATIONAL_DEBUT은 club MatchRecord를 국가대표 경기로 바꾸지 않고 virtualOpponent를 맥락으로 노출한다', () => {
    const state = baseState({
      pending: {
        kind: 'CHAPTER',
        step: 2,
        chapterId: NATIONAL_DEFINITION.id,
        version: 1,
        importance: 'MAJOR',
        trigger: 'NATIONAL_DEBUT',
        matchId: MATCH.id,
        decisionsTotal: 2,
        resolved: [],
        virtualOpponent: NATIONAL_OPPONENT,
      },
      season: seasonWith({}),
    });

    const view = deriveChapterView(state, NATIONAL_PACK);

    expect(view).not.toBeNull();
    expect(view?.context).toEqual({ kind: 'NATIONAL_TEAM', competition: 'NATIONAL_TEAM', opponent: NATIONAL_OPPONENT });
    expect(view?.match).toBe(MATCH);
    expect(view?.match.opponent).toEqual(MATCH.opponent);
  });

  it('판단 하나가 확정되면 그 판단을 정의로 복원해 resolved에 담고 인덱스를 하나 올린다', () => {
    const state = baseState({
      pending: {
        kind: 'CHAPTER',
        step: 2,
        chapterId: DEFINITION.id,
        version: 1,
        importance: 'MAJOR',
        trigger: 'DEBUT',
        matchId: MATCH.id,
        decisionsTotal: 2,
        resolved: [{ decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', roll: 1234, outcomeKind: 'SUCCESS' }],
      },
      season: seasonWith({}),
    });

    const view = deriveChapterView(state, PACK);

    expect(view?.currentDecisionIndex).toBe(1);
    expect(view?.resolved).toHaveLength(1);
    expect(view?.resolved[0]?.decision.id).toBe('D1');
    expect(view?.resolved[0]?.option.id).toBe('SAFE');
    expect(view?.resolved[0]?.outcome.id).toBe('D1-SUCCESS');
    expect(view?.resolved[0]?.outcome.title).toBe('D1 성공');
  });

  it('pending이 없고 직전 timeline이 CHAPTER_RESOLVED면 season.chapters의 마지막 기록으로 결과 뷰를 만든다', () => {
    const chapterRecord: ChapterRecord = {
      chapterId: DEFINITION.id,
      version: 1,
      step: 2,
      matchId: MATCH.id,
      importance: 'MAJOR',
      trigger: 'DEBUT',
      decisions: [
        { decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', outcomeKind: 'SUCCESS' },
        { decisionId: 'D2', optionId: 'BOLD', outcomeId: 'D2-FAIL', outcomeKind: 'FAIL' },
      ],
      ratingDeltaTenths: -2,
    };
    const state = baseState({
      pending: null,
      season: seasonWith({ chapters: [chapterRecord] }),
      timeline: [{ revision: 5, kind: 'CHAPTER_RESOLVED', refId: `${DEFINITION.id}:D2:BOLD:D2-FAIL`, age: 17, step: 2 }],
    });

    const view = deriveChapterView(state, PACK);

    expect(view?.completed).toBe(true);
    expect(view?.decisionsTotal).toBe(2);
    expect(view?.currentDecisionIndex).toBe(2);
    expect(view?.resolved).toHaveLength(2);
    expect(view?.resolved[1]?.outcome.id).toBe('D2-FAIL');
    expect(view?.chapterRecord).toEqual(chapterRecord);
  });

  it('완료된 NATIONAL_DEBUT도 ChapterRecord의 virtualOpponent와 국가대표 맥락을 복원한다', () => {
    const chapterRecord: ChapterRecord = {
      chapterId: NATIONAL_DEFINITION.id,
      version: 1,
      step: 2,
      matchId: MATCH.id,
      importance: 'MAJOR',
      trigger: 'NATIONAL_DEBUT',
      decisions: [
        { decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', outcomeKind: 'SUCCESS' },
        { decisionId: 'D2', optionId: 'BOLD', outcomeId: 'D2-FAIL', outcomeKind: 'FAIL' },
      ],
      ratingDeltaTenths: 0,
      virtualOpponent: NATIONAL_OPPONENT,
    };
    const state = baseState({
      pending: null,
      season: seasonWith({ chapters: [chapterRecord] }),
      timeline: [{ revision: 5, kind: 'CHAPTER_RESOLVED', refId: `${NATIONAL_DEFINITION.id}:D2:BOLD:D2-FAIL`, age: 17, step: 2 }],
    });

    const view = deriveChapterView(state, NATIONAL_PACK);

    expect(view).not.toBeNull();
    expect(view?.completed).toBe(true);
    expect(view?.context).toEqual({ kind: 'NATIONAL_TEAM', competition: 'NATIONAL_TEAM', opponent: NATIONAL_OPPONENT });
    expect(view?.chapterRecord).toEqual(chapterRecord);
    expect(view?.match.opponent).toEqual(MATCH.opponent);
  });

  it('같은 상태를 다시 읽어도(새로고침·뒤로 가기 시뮬레이션) 같은 뷰를 돌려준다', () => {
    const state = baseState({
      pending: {
        kind: 'CHAPTER',
        step: 2,
        chapterId: DEFINITION.id,
        version: 1,
        importance: 'MAJOR',
        trigger: 'DEBUT',
        matchId: MATCH.id,
        decisionsTotal: 2,
        resolved: [{ decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', roll: 1234, outcomeKind: 'SUCCESS' }],
      },
      season: seasonWith({}),
    });

    const first = deriveChapterView(state, PACK);
    const second = deriveChapterView(state, PACK);

    expect(first).toEqual(second);
  });

  it('pending도 CHAPTER_RESOLVED 직후도 아니면 null이다(이 화면에 있을 이유가 없다)', () => {
    const state = baseState({
      pending: null,
      timeline: [{ revision: 1, kind: 'STEP_PASSED', refId: null, age: 17, step: 1 }],
    });

    expect(deriveChapterView(state, PACK)).toBeNull();
  });

  it('pending CHAPTER인데 season이 없으면 null이다(방어적)', () => {
    const state = baseState({
      pending: { kind: 'CHAPTER', step: 2, chapterId: DEFINITION.id, version: 1, importance: 'MAJOR', trigger: 'DEBUT', matchId: MATCH.id, decisionsTotal: 2, resolved: [] },
      season: null,
    });

    expect(deriveChapterView(state, PACK)).toBeNull();
  });

  it('pending CHAPTER인데 season.matches에 matchId가 없으면 null이다(방어적)', () => {
    const state = baseState({
      pending: { kind: 'CHAPTER', step: 2, chapterId: DEFINITION.id, version: 1, importance: 'MAJOR', trigger: 'DEBUT', matchId: 'missing-match', decisionsTotal: 2, resolved: [] },
      season: seasonWith({}),
    });

    expect(deriveChapterView(state, PACK)).toBeNull();
  });

  it('pending CHAPTER인데 팩에 chapterId 정의가 없으면 null이다(방어적)', () => {
    const state = baseState({
      pending: { kind: 'CHAPTER', step: 2, chapterId: 'CHP-MISSING', version: 1, importance: 'MAJOR', trigger: 'DEBUT', matchId: MATCH.id, decisionsTotal: 1, resolved: [] },
      season: seasonWith({}),
    });

    expect(deriveChapterView(state, PACK)).toBeNull();
  });

  it('resolved 항목의 decisionId·optionId·outcomeId가 정의에 없으면 null이다(방어적)', () => {
    const state = baseState({
      pending: {
        kind: 'CHAPTER',
        step: 2,
        chapterId: DEFINITION.id,
        version: 1,
        importance: 'MAJOR',
        trigger: 'DEBUT',
        matchId: MATCH.id,
        decisionsTotal: 2,
        resolved: [{ decisionId: 'D1', optionId: 'DOES-NOT-EXIST', outcomeId: 'D1-SUCCESS', roll: 1, outcomeKind: 'SUCCESS' }],
      },
      season: seasonWith({}),
    });

    expect(deriveChapterView(state, PACK)).toBeNull();
  });
});

describe('deriveNationalTeamResultSummary', () => {
  it('완료된 NATIONAL_DEBUT 챕터 뷰에서 상대·판단 성공률·데뷔 확정 여부를 요약한다(이슈 150)', () => {
    const chapterRecord: ChapterRecord = {
      chapterId: NATIONAL_DEFINITION.id,
      version: 1,
      step: 2,
      matchId: MATCH.id,
      importance: 'MAJOR',
      trigger: 'NATIONAL_DEBUT',
      decisions: [
        { decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', outcomeKind: 'SUCCESS' },
        { decisionId: 'D2', optionId: 'BOLD', outcomeId: 'D2-FAIL', outcomeKind: 'FAIL' },
      ],
      ratingDeltaTenths: 0,
      virtualOpponent: NATIONAL_OPPONENT,
    };
    const state = baseState({
      pending: null,
      season: seasonWith({ chapters: [chapterRecord] }),
      timeline: [{ revision: 5, kind: 'CHAPTER_RESOLVED', refId: `${NATIONAL_DEFINITION.id}:D2:BOLD:D2-FAIL`, age: 17, step: 2 }],
    });

    const view = deriveChapterView(state, NATIONAL_PACK);
    const summary = view === null ? null : deriveNationalTeamResultSummary(view);

    expect(summary).not.toBeNull();
    expect(summary?.opponentName).toBe(NATIONAL_OPPONENT.opponentName);
    expect(summary?.successCount).toBe(1);
    expect(summary?.totalCount).toBe(2);
    expect(summary?.debutConfirmed).toBe(true);
    expect(summary?.decisions.map((resolved) => resolved.outcome.title)).toEqual(['D1 성공', 'D2 실패']);
  });

  it('리그(CLUB) 챕터 뷰에서는 요약을 만들지 않는다(대표팀 전용)', () => {
    const chapterRecord: ChapterRecord = {
      chapterId: DEFINITION.id,
      version: 1,
      step: 2,
      matchId: MATCH.id,
      importance: 'MAJOR',
      trigger: 'DEBUT',
      decisions: [
        { decisionId: 'D1', optionId: 'SAFE', outcomeId: 'D1-SUCCESS', outcomeKind: 'SUCCESS' },
        { decisionId: 'D2', optionId: 'BOLD', outcomeId: 'D2-FAIL', outcomeKind: 'FAIL' },
      ],
      ratingDeltaTenths: -2,
    };
    const state = baseState({
      pending: null,
      season: seasonWith({ chapters: [chapterRecord] }),
      timeline: [{ revision: 5, kind: 'CHAPTER_RESOLVED', refId: `${DEFINITION.id}:D2:BOLD:D2-FAIL`, age: 17, step: 2 }],
    });

    const view = deriveChapterView(state, PACK);

    expect(view).not.toBeNull();
    expect(view === null ? null : deriveNationalTeamResultSummary(view)).toBeNull();
  });
});
