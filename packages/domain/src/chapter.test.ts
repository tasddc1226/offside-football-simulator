import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { matchesTrigger, resolveChapter, selectChapter, type ChapterCandidateInput, type SelectChapterInput } from './chapter.js';
import { hashState } from './hash.js';
import { computeRatingTenths } from './match.js';
import { rollInt, seedRng } from './rng.js';
import { findLeague } from './schedule.js';
import { walkToNextDecision, type ChapterWalkContext, type PlayStepMatches } from './season.js';
import { simulate } from './simulate.js';
import type {
  CareerState,
  ChapterTrigger,
  CompetitionRecord,
  DomainSnapshot,
  FootballSeason,
  MatchRecord,
  Pending,
  PositionStats,
  SeasonStep,
} from './types.js';

// league-youth: teamCount 8, rivalOpponentIndex 4, promotionSpots 2, relegationSpots 2(브리프 D-38 지정값).
const league = findLeague(rulesetProto, 'league-youth');

function makeMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'm1',
    step: 3,
    order: 1,
    competitionId: 'LEAGUE',
    kind: 'LEAGUE',
    round: null,
    opponent: { id: 'league-youth-opp-1', name: 'Opp', strength: 50 },
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
    chapterId: null,
    ...overrides,
  };
}

function makeStep(overrides: Partial<SeasonStep> = {}): SeasonStep {
  return {
    index: 3,
    phase: 'LEAGUE',
    windowOpen: false,
    decisionSlots: [{ kind: 'CHAPTER', required: false }],
    summary: null,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<ChapterCandidateInput> = {}): ChapterCandidateInput {
  return {
    chapterId: 'CHP-MATCH-001',
    version: 1,
    importance: 'MAJOR',
    trigger: { kind: 'DEBUT' },
    weight: 100,
    decisionsTotal: 1,
    ...overrides,
  };
}

function baseSelectInput(overrides: Partial<SelectChapterInput> = {}): SelectChapterInput {
  const step = overrides.step ?? makeStep();
  return {
    step,
    steps: [step],
    seasonIndex: 1,
    mode: 'CHAPTER',
    matchesThisStep: [makeMatch()],
    matchesBeforeThisStep: [],
    competitions: [],
    candidates: [makeCandidate()],
    tags: [],
    resolvedChapterIds: [],
    existingChapterIds: [],
    league,
    ...overrides,
  };
}

describe('matchesTrigger', () => {
  const ctx = {
    seasonIndex: 1,
    isFirstCareerAppearance: true,
    isLastLeagueStep: true,
    league,
    leaguePosition: 2,
    tags: ['TAG-X'],
  };

  it('minutes가 0이면 어떤 트리거도 맞지 않는다', () => {
    const match = makeMatch({ minutes: 0 });
    expect(matchesTrigger({ kind: 'DEBUT' }, match, ctx)).toBe(false);
  });

  it('DEBUT은 첫 시즌·첫 출전에서만 맞는다', () => {
    const match = makeMatch();
    expect(matchesTrigger({ kind: 'DEBUT' }, match, ctx)).toBe(true);
    expect(matchesTrigger({ kind: 'DEBUT' }, match, { ...ctx, isFirstCareerAppearance: false })).toBe(false);
    expect(matchesTrigger({ kind: 'DEBUT' }, match, { ...ctx, seasonIndex: 2 })).toBe(false);
  });

  it('DERBY는 rivalOpponentIndex 상대(리그 경기)에서만 맞는다', () => {
    const rivalMatch = makeMatch({ opponent: { id: 'league-youth-opp-4', name: 'Rival', strength: 50 } });
    expect(matchesTrigger({ kind: 'DERBY' }, rivalMatch, ctx)).toBe(true);
    const otherMatch = makeMatch({ opponent: { id: 'league-youth-opp-1', name: 'Other', strength: 50 } });
    expect(matchesTrigger({ kind: 'DERBY' }, otherMatch, ctx)).toBe(false);
    const cupVsRival = makeMatch({ kind: 'CUP', competitionId: 'CUP', round: 'R1', opponent: { id: 'league-youth-opp-4', name: 'Rival', strength: 50 } });
    expect(matchesTrigger({ kind: 'DERBY' }, cupVsRival, ctx)).toBe(false);
  });

  it('DECIDER는 마지막 리그 step이고 경계 ±maxRankGap 안일 때만 맞는다', () => {
    const match = makeMatch();
    const trigger: ChapterTrigger = { kind: 'DECIDER', maxRankGap: 1 };
    expect(matchesTrigger(trigger, match, { ...ctx, isLastLeagueStep: true, leaguePosition: 2 })).toBe(true);
    expect(matchesTrigger(trigger, match, { ...ctx, isLastLeagueStep: true, leaguePosition: 4 })).toBe(false);
    expect(matchesTrigger(trigger, match, { ...ctx, isLastLeagueStep: false, leaguePosition: 2 })).toBe(false);
  });

  it('TAG는 state.tags에 포함될 때만 맞는다', () => {
    const match = makeMatch();
    expect(matchesTrigger({ kind: 'TAG', tag: 'TAG-X' }, match, ctx)).toBe(true);
    expect(matchesTrigger({ kind: 'TAG', tag: 'TAG-Y' }, match, ctx)).toBe(false);
  });
});

describe('selectChapter', () => {
  it('DEBUT: 커리어 첫 minutes>0 경기에서만 열리고, 두 번째 시즌에는 열리지 않는다', () => {
    expect(selectChapter(baseSelectInput())).toEqual({
      chapterId: 'CHP-MATCH-001',
      version: 1,
      importance: 'MAJOR',
      matchId: 'm1',
      decisionsTotal: 1,
    });

    // 이 step 이전에 이미 minutes>0 출전이 있었다면 "첫 출전"이 아니다.
    expect(
      selectChapter(baseSelectInput({ matchesBeforeThisStep: [makeMatch({ id: 'm0', step: 1, minutes: 45 })] })),
    ).toBeNull();

    // 두 번째 시즌은 seasonIndex !== 1이라 DEBUT이 열리지 않는다.
    expect(selectChapter(baseSelectInput({ seasonIndex: 2 }))).toBeNull();
  });

  it('DERBY: rivalOpponentIndex 상대에서만 열린다', () => {
    const candidate = makeCandidate({ chapterId: 'CHP-MATCH-002', importance: 'MINOR', trigger: { kind: 'DERBY' } });
    const rivalMatch = makeMatch({ opponent: { id: 'league-youth-opp-4', name: 'Rival', strength: 50 } });
    expect(selectChapter(baseSelectInput({ candidates: [candidate], matchesThisStep: [rivalMatch] }))).toEqual({
      chapterId: 'CHP-MATCH-002',
      version: 1,
      importance: 'MINOR',
      matchId: 'm1',
      decisionsTotal: 1,
    });

    const otherMatch = makeMatch({ opponent: { id: 'league-youth-opp-1', name: 'Other', strength: 50 } });
    expect(selectChapter(baseSelectInput({ candidates: [candidate], matchesThisStep: [otherMatch] }))).toBeNull();
  });

  it('DECIDER: 마지막 LEAGUE step에서 경계 ±maxRankGap일 때만 열리고, 경계 밖이면 null이다', () => {
    const earlyStep = makeStep({ index: 3 });
    const lastStep = makeStep({ index: 7 });
    const candidate = makeCandidate({ chapterId: 'CHP-MATCH-004', trigger: { kind: 'DECIDER', maxRankGap: 1 } });
    const nearPromotion: CompetitionRecord = {
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      played: 10,
      won: 5,
      drawn: 2,
      lost: 3,
      goalsFor: 10,
      goalsAgainst: 8,
      position: 2, // promotionSpots(2) 정중앙
      cupRound: null,
    };

    expect(
      selectChapter(
        baseSelectInput({ step: lastStep, steps: [earlyStep, lastStep], candidates: [candidate], competitions: [nearPromotion] }),
      ),
    ).toEqual({ chapterId: 'CHP-MATCH-004', version: 1, importance: 'MAJOR', matchId: 'm1', decisionsTotal: 1 });

    // 경계에서 멀다(4위, promotionSpots=2·relegationBoundary=7에서 모두 maxRankGap=1 밖).
    const farFromBoundary: CompetitionRecord = { ...nearPromotion, position: 4 };
    expect(
      selectChapter(
        baseSelectInput({ step: lastStep, steps: [earlyStep, lastStep], candidates: [candidate], competitions: [farFromBoundary] }),
      ),
    ).toBeNull();

    // 마지막 리그 step이 아니면 경계 안이어도 열리지 않는다.
    expect(
      selectChapter(
        baseSelectInput({ step: earlyStep, steps: [earlyStep, lastStep], candidates: [candidate], competitions: [nearPromotion] }),
      ),
    ).toBeNull();
  });

  it('FAST 모드는 MAJOR 챕터만 열고, MINOR 후보는 거른다', () => {
    const minorCandidate = makeCandidate({ importance: 'MINOR' });
    expect(selectChapter(baseSelectInput({ mode: 'FAST', candidates: [minorCandidate] }))).toBeNull();

    const majorCandidate = makeCandidate({ importance: 'MAJOR' });
    expect(selectChapter(baseSelectInput({ mode: 'FAST', candidates: [majorCandidate] }))).not.toBeNull();
  });

  it('walkToNextDecision: 같은 rngState·같은 경기 결과에서 CHAPTER 모드는 MINOR 더비를 열고 FAST 모드는 건너뛴다', () => {
    // 브리프 golden·fixture 절차: "FAST 모드 재생에서 MINOR 더비 챕터가 열리지 않는 것을 같은 seed의
    // CHAPTER/FAST 쌍으로 검증한다" — selectChapter 단위 테스트(위)와 달리, 여기서는 실제
    // walkToNextDecision을 같은 rngState·같은 경기 데이터로 두 번(CHAPTER/FAST) 돌려 pending 차이를 본다.
    const derbyCandidate = makeCandidate({ chapterId: 'CHP-MATCH-002', importance: 'MINOR', trigger: { kind: 'DERBY' } });
    const derbyMatch = makeMatch({ id: 'm-derby', step: 6, opponent: { id: 'league-youth-opp-4', name: 'Rival', strength: 50 } });
    const derbyStep = makeStep({ index: 6, decisionSlots: [{ kind: 'CHAPTER', required: false, importance: 'MINOR' }] });
    const trailingSteps = [7, 8, 9, 10, 11].map((index) =>
      makeStep({ index, decisionSlots: [{ kind: 'EVENT', required: false }] }),
    );
    const steps = [derbyStep, ...trailingSteps];

    const playStepMatches: PlayStepMatches = (stepIndex) =>
      stepIndex === 6 ? { results: [], records: [derbyMatch], competitions: [] } : { results: [], records: [], competitions: [] };

    const chapterContext: ChapterWalkContext = {
      chapterCandidates: [derbyCandidate],
      tags: [],
      resolvedChapterIds: [],
      existingChapterIds: [],
      league,
      seasonIndex: 1,
    };

    const sameSeedRngState = seedRng('chapter-fast-vs-chapter-same-seed');

    const chapterWalk = walkToNextDecision(steps, 6, 'CHAPTER', [], sameSeedRngState, 1, null, playStepMatches, [], chapterContext);
    const fastWalk = walkToNextDecision(steps, 6, 'FAST', [], sameSeedRngState, 1, null, playStepMatches, [], chapterContext);

    // 같은 seed·같은 playStepMatches이므로 두 모드의 경기 결과 자체는 동일하다(챕터 개폐만 갈린다).
    expect(chapterWalk.pending).toMatchObject({ kind: 'CHAPTER', chapterId: 'CHP-MATCH-002', matchId: 'm-derby', step: 6 });
    expect(fastWalk.pending?.kind).not.toBe('CHAPTER');
    expect(fastWalk.pending).toEqual({ kind: 'SETTLEMENT', step: 12 });
  });

  it('후보가 여럿이면 MAJOR > weight desc > chapterId 오름차순 순으로 하나만 고른다', () => {
    const minorHighWeight = makeCandidate({ chapterId: 'CHP-Z', importance: 'MINOR', weight: 200 });
    const majorLowWeight = makeCandidate({ chapterId: 'CHP-B', importance: 'MAJOR', weight: 50 });
    const majorHighWeight = makeCandidate({ chapterId: 'CHP-A', importance: 'MAJOR', weight: 100 });

    const winner = selectChapter(baseSelectInput({ candidates: [minorHighWeight, majorLowWeight, majorHighWeight] }));
    expect(winner?.chapterId).toBe('CHP-A'); // MAJOR 우선, 그중 weight가 가장 크다.

    // weight가 같으면 chapterId 코드포인트 오름차순이다.
    const majorTieA = makeCandidate({ chapterId: 'CHP-B', importance: 'MAJOR', weight: 100 });
    const majorTieB = makeCandidate({ chapterId: 'CHP-A', importance: 'MAJOR', weight: 100 });
    const tieWinner = selectChapter(baseSelectInput({ candidates: [majorTieA, majorTieB] }));
    expect(tieWinner?.chapterId).toBe('CHP-A');
  });
});

function makePendingChapter(overrides: Partial<Extract<Pending, { kind: 'CHAPTER' }>> = {}): Extract<Pending, { kind: 'CHAPTER' }> {
  return {
    kind: 'CHAPTER',
    step: 3,
    chapterId: 'CHP-MATCH-001',
    version: 1,
    importance: 'MAJOR',
    matchId: 'm1',
    decisionsTotal: 1,
    resolved: [],
    ...overrides,
  };
}

const FW_STATS: PositionStats = { group: 'FW', goals: 1, assists: 0, xgCenti: 30, shots: 3, offsides: 0 };

function makeSeason(overrides: Partial<FootballSeason> = {}): FootballSeason {
  return {
    index: 1,
    serviceSeasonId: 'svc-test',
    simulationMode: 'CHAPTER',
    calendarId: 'default',
    currentStep: 3,
    phase: 'LEAGUE',
    steps: [makeStep()],
    teamId: 'team-1',
    styleId: 'style-1',
    squadRole: 'STARTER',
    squadRoleAtStart: 'STARTER',
    trainingFocus: 'ROLE',
    competitions: [],
    schedule: [],
    matches: [makeMatch()],
    ageReferenceStep: 1,
    squad: { competitors: [] },
    selection: { position: 'ST', slots: 1, benchSlots: 0, candidates: [], playerReason: null },
    playerStats: {
      group: 'FW',
      appearances: { total: 1, started: 1, sub: 0, zeroMinute: 0, out: 0 },
      minutes: 90,
      ratingSumTenths: 70,
      ratedMatches: 1,
      yellow: 0,
      red: 0,
      injuries: 0,
      totals: { group: 'FW', goals: 1, assists: 0, xgCenti: 30, shots: 3, offsides: 0 },
    },
    availability: null,
    lastRatingTenths: 70,
    yellowSuspensionCount: 0,
    matchRngState: seedRng('chapter-test-match-rng'),
    scheduledEffects: [],
    chapters: [],
    ...overrides,
  };
}

function makeState(overrides: Partial<CareerState> = {}): CareerState {
  return {
    schemaVersion: 1,
    careerId: 'car_test',
    status: 'ACTIVE',
    stage: 'PRO',
    age: 18,
    currentStep: 3,
    seasonPhase: 'LEAGUE',
    simulationMode: 'CHAPTER',
    attributes: {
      shooting: 52,
      passing: 54,
      dribbling: 66,
      tackling: 30,
      firstTouch: 62,
      crossing: 45,
      goalkeeping: 1,
      pace: 68,
      acceleration: 70,
      agility: 64,
      jumping: 50,
      stamina: 55,
      strength: 42,
      durability: 60,
      decisions: 52,
      concentration: 48,
      composure: 52,
      positioning: 60,
      leadership: 35,
      consistency: 45,
    },
    growthCarryCenti: {
      shooting: 0,
      passing: 0,
      dribbling: 0,
      tackling: 0,
      firstTouch: 0,
      crossing: 0,
      goalkeeping: 0,
      pace: 0,
      acceleration: 0,
      agility: 0,
      jumping: 0,
      stamina: 0,
      strength: 0,
      durability: 0,
      decisions: 0,
      concentration: 0,
      composure: 0,
      positioning: 0,
      leadership: 0,
      consistency: 0,
    },
    state: { form: 50, fitness: 80, morale: 60 },
    context: { tacticalFit: 58, squadStatus: 40, positionProficiency: 100 },
    relationships: { managerTrust: 40, captain: 0, rival: 0, fans: 0, agent: 0 },
    tags: [],
    appliedSourceIds: [],
    activeEffects: [],
    deferredEffects: [],
    resolvedEventIds: [],
    resolvedChapterIds: [],
    rngState: seedRng('chapter-test'),
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
    player: {
      draft: { name: null, gender: null, nationalityCode: null, preferredFoot: null, position: null, archetypeId: null, backgroundId: null },
      profile: null,
    },
    pending: makePendingChapter(),
    contract: null,
    timeline: [],
    season: makeSeason(),
    seasonHistory: [],
    ...overrides,
  };
}

describe('resolveChapter', () => {
  it('roll은 1회만 소비하고, resolveEvent와 같은 누적 가중치로 outcome을 고른다', () => {
    const state = makeState();
    const expectedRoll = rollInt(state.rngState, 100);
    const outcomes = [
      { id: 'A', weight: 30, effects: [], ratingDeltaTenths: 0 },
      { id: 'B', weight: 70, effects: [], ratingDeltaTenths: 0 },
    ];

    const result = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.roll).toBe(expectedRoll.value);
    expect(result.state.rngState).toEqual(expectedRoll.state); // roll 정확히 1회.
    expect(result.outcomeId).toBe(expectedRoll.value < 30 ? 'A' : 'B');
  });

  it('DECISION_ALREADY_RESOLVED: 이미 확정된 decisionId를 다시 보내면 거부한다', () => {
    const state = makeState({
      pending: makePendingChapter({
        decisionsTotal: 2,
        resolved: [{ decisionId: 'D1', optionId: 'OPT-A', outcomeId: 'A', roll: 0 }],
      }),
    });
    const result = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-B',
      outcomes: [{ id: 'X', weight: 1, effects: [], ratingDeltaTenths: 0 }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'DECISION_ALREADY_RESOLVED' });
  });

  it('PENDING_CHAPTER_MISMATCH: pending과 chapterId·version이 다르면 거부한다', () => {
    const state = makeState();
    const wrongChapterId = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-OTHER',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes: [{ id: 'X', weight: 1, effects: [], ratingDeltaTenths: 0 }],
    });
    expect(wrongChapterId).toMatchObject({ ok: false, reason: 'PENDING_CHAPTER_MISMATCH' });

    const wrongVersion = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 2,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes: [{ id: 'X', weight: 1, effects: [], ratingDeltaTenths: 0 }],
    });
    expect(wrongVersion).toMatchObject({ ok: false, reason: 'PENDING_CHAPTER_MISMATCH' });
  });

  it('NO_PENDING_CHAPTER: pending이 CHAPTER가 아니면 거부한다', () => {
    const state = makeState({ pending: { kind: 'CONTRACT', step: 3 } });
    const result = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes: [{ id: 'X', weight: 1, effects: [], ratingDeltaTenths: 0 }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'NO_PENDING_CHAPTER' });
  });

  it('ratingDeltaTenths는 clamp(40,100) 이후 실제 변화량이고, ratingSumTenths는 matches.ratingTenths 합(null 제외)과 같다', () => {
    const otherMatch = makeMatch({ id: 'm0', order: 0, ratingTenths: 65 });
    const baseline = computeRatingTenths('FW', FW_STATS, 'WIN', { yellow: 0, red: false }, rulesetProto);
    const chapterMatch = makeMatch({ id: 'm1', order: 1, stats: FW_STATS, ratingTenths: baseline });
    const season = makeSeason({
      matches: [otherMatch, chapterMatch],
      playerStats: {
        ...makeSeason().playerStats,
        ratingSumTenths: 65 + baseline,
        ratedMatches: 2,
      },
      lastRatingTenths: baseline,
    });
    const state = makeState({ season, pending: makePendingChapter({ matchId: 'm1' }) });

    // 상한 clamp: 큰 양수 델타를 줘도 100을 넘지 못한다.
    const upperResult = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes: [{ id: 'ONLY', weight: 1, effects: [], ratingDeltaTenths: 1000 }],
    });
    expect(upperResult.ok).toBe(true);
    if (!upperResult.ok) return;
    const upperMatch = upperResult.state.season!.matches.find((m) => m.id === 'm1')!;
    expect(upperMatch.ratingTenths).toBe(100);
    expect(upperResult.state.season!.chapters).toHaveLength(1);
    expect(upperResult.state.season!.chapters[0]!.ratingDeltaTenths).toBe(100 - baseline);
    const upperSum = upperResult.state.season!.matches.reduce((sum, m) => (m.ratingTenths === null ? sum : sum + m.ratingTenths), 0);
    expect(upperResult.state.season!.playerStats.ratingSumTenths).toBe(upperSum);

    // 하한 clamp: 큰 음수 델타를 줘도 40 밑으로 내려가지 않는다.
    const lowerResult = resolveChapter({
      state,
      ruleset: rulesetProto,
      chapterId: 'CHP-MATCH-001',
      definitionVersion: 1,
      decisionId: 'D1',
      optionId: 'OPT-A',
      outcomes: [{ id: 'ONLY', weight: 1, effects: [], ratingDeltaTenths: -1000 }],
    });
    expect(lowerResult.ok).toBe(true);
    if (!lowerResult.ok) return;
    const lowerMatch = lowerResult.state.season!.matches.find((m) => m.id === 'm1')!;
    expect(lowerMatch.ratingTenths).toBe(40);
    expect(lowerResult.state.season!.chapters[0]!.ratingDeltaTenths).toBe(40 - baseline);
    const lowerSum = lowerResult.state.season!.matches.reduce((sum, m) => (m.ratingTenths === null ? sum : sum + m.ratingTenths), 0);
    expect(lowerResult.state.season!.playerStats.ratingSumTenths).toBe(lowerSum);
  });

  // resolveChapter 자체는 timeline을 건드리지 않는다(simulate.ts의 resolveChapterCommand 몫) —
  // "timeline 3건"은 simulate()로 RESOLVE_CHAPTER 3번을 실제로 보내 검증한다.
  it('판단 3개를 모두 확정하면 pending null·chapters 1건·timeline 3건(CHAPTER_RESOLVED)이 남는다', () => {
    const state = makeState({ pending: makePendingChapter({ decisionsTotal: 3 }) });
    const initialSnapshot: DomainSnapshot = {
      revision: 5,
      checkpoint: 'CHAPTER_DECISION',
      state,
      stateHash: hashState(state),
      rulesetVersion: state.rulesetVersion,
      contentPackVersion: state.contentPackVersion,
    };

    let snapshot = initialSnapshot;
    for (const decisionId of ['D1', 'D2', 'D3']) {
      const result = simulate({
        snapshot,
        command: {
          type: 'RESOLVE_CHAPTER',
          commandId: `cmd-${decisionId}`,
          expectedRevision: snapshot.revision,
          payload: {
            chapterId: 'CHP-MATCH-001',
            definitionVersion: 1,
            decisionId,
            optionId: 'OPT-A',
            outcomes: [{ id: `${decisionId}-OUT`, weight: 1, effects: [], ratingDeltaTenths: 1 }],
          },
        },
        ruleset: rulesetProto,
        rulesetVersion: rulesetProto.version,
        contentPackVersion: '0.1.0',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      snapshot = result.snapshot;
    }

    expect(snapshot.state.pending).toBeNull();
    expect(snapshot.state.season!.chapters).toHaveLength(1);
    expect(snapshot.state.season!.chapters[0]!.decisions).toHaveLength(3);
    const timelineEntries = snapshot.state.timeline.filter((entry) => entry.kind === 'CHAPTER_RESOLVED');
    expect(timelineEntries).toHaveLength(3);
  });
});
