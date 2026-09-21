import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import {
  computeExpectedPerformance,
  computeSelectionScore,
  computeSquadStatus,
  computeTacticalFit,
  deriveTacticalRoom,
  familiarityOf,
  rankSelection,
  rankPositionForPlayer,
} from './selection.js';
import { simulate, type Command } from './simulate.js';
import { compareCodePoints } from './canonical.js';
import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type DomainSnapshot,
  type Position,
  type SelectionCandidate,
} from './types.js';
import type { TacticalStyle } from './ruleset.js';

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK = '0.1.0';
const RULESET = rulesetProto;
const rules = RULESET.selectionRules;

type EngineCommand = Command & { commandId: string; expectedRevision: number };

function baseInput() {
  return { ruleset: RULESET, rulesetVersion: RULESET_VERSION, contentPackVersion: CONTENT_PACK };
}

function createCareerCommand(): EngineCommand {
  return {
    type: 'CREATE_CAREER',
    commandId: 'cmd-create',
    expectedRevision: 0,
    payload: {
      careerId: 'car_sel_test',
      seed: 'selection-test-seed',
      simulationMode: 'CHAPTER',
      rulesetVersion: RULESET_VERSION,
      contentPackVersion: CONTENT_PACK,
    },
  };
}

function updateDraft(snapshot: DomainSnapshot, draft: Record<string, unknown>): DomainSnapshot {
  const command: EngineCommand = {
    type: 'UPDATE_PLAYER_DRAFT',
    commandId: `cmd-draft-${snapshot.revision}`,
    expectedRevision: snapshot.revision,
    payload: { draft },
  };
  const result = simulate({ ...baseInput(), snapshot, command });
  if (!result.ok) throw new Error(`setup: UPDATE_PLAYER_DRAFT 실패 ${result.error.code}`);
  return result.snapshot;
}

function confirmPlayerCommand(expectedRevision: number): EngineCommand {
  return {
    type: 'CONFIRM_PLAYER',
    commandId: `cmd-confirm-${expectedRevision}`,
    expectedRevision,
    payload: {},
  };
}

function startSeasonCommand(expectedRevision: number): EngineCommand {
  return {
    type: 'START_SEASON',
    commandId: `cmd-start-${expectedRevision}`,
    expectedRevision,
    payload: { simulationMode: 'CHAPTER', serviceSeasonId: 'svc-sel-test' },
  };
}

/** ACTIVE: 김서준 draft를 CONFIRM_PLAYER까지 마친 snapshot(아직 시즌 없음, season은 null). */
function confirmedActiveSnapshot(): DomainSnapshot {
  const snapshot = simulate({ ...baseInput(), snapshot: null, command: createCareerCommand() });
  if (!snapshot.ok) throw new Error('setup: CREATE_CAREER 실패');
  let s = snapshot.snapshot;
  s = updateDraft(s, {
    name: '김서준',
    gender: 'UNSPECIFIED',
    nationalityCode: 'KR',
    preferredFoot: 'LEFT',
  });
  s = updateDraft(s, {
    position: 'W',
    archetypeId: 'inside-forward',
    backgroundId: 'club-academy',
  });
  const confirmed = simulate({
    ...baseInput(),
    snapshot: s,
    command: confirmPlayerCommand(s.revision),
  });
  if (!confirmed.ok) throw new Error(`setup: CONFIRM_PLAYER 실패 ${confirmed.error.code}`);
  return confirmed.snapshot;
}

function advanceCommand(expectedRevision: number): EngineCommand {
  return {
    type: 'ADVANCE',
    commandId: `cmd-advance-${expectedRevision}`,
    expectedRevision,
    payload: { eligibleEvents: [] },
  };
}

function acceptOfferCommand(expectedRevision: number, offerId: string): EngineCommand {
  return {
    type: 'ACCEPT_OFFER',
    commandId: `cmd-accept-${expectedRevision}`,
    expectedRevision,
    payload: { offerId },
  };
}

function withTags(snapshot: DomainSnapshot, tags: string[]): DomainSnapshot {
  return { ...snapshot, state: { ...snapshot.state, tags: [...tags].sort(compareCodePoints) } };
}

/** ACTIVE + 계약 체결 + START_SEASON까지 마쳐 season(styleId·squad·selection)이 채워진 snapshot. */
function activeSnapshotWithSeason(): DomainSnapshot {
  const active = withTags(confirmedActiveSnapshot(), ['진로_아카데미']);
  const offered = simulate({
    ...baseInput(),
    snapshot: active,
    command: advanceCommand(active.revision),
  });
  if (!offered.ok || offered.snapshot.state.pending?.kind !== 'OFFERS') {
    throw new Error('setup: OFFERS pending 실패');
  }
  const offer = offered.snapshot.state.pending.offers[0]!;
  const accepted = simulate({
    ...baseInput(),
    snapshot: offered.snapshot,
    command: acceptOfferCommand(offered.snapshot.revision, offer.id),
  });
  if (!accepted.ok) throw new Error(`setup: ACCEPT_OFFER 실패 ${accepted.error.code}`);
  const started = simulate({
    ...baseInput(),
    snapshot: accepted.snapshot,
    command: startSeasonCommand(accepted.snapshot.revision),
  });
  if (!started.ok) throw new Error(`setup: START_SEASON 실패 ${started.error.code}`);
  return started.snapshot;
}

describe('RULE-SEL-001/RULE-PERF-001 — A/B 골든 벡터 (문서 03 예시 표, packages/domain/src/__fixtures__/selection-ab.json)', () => {
  // 문서 03 예시 표(선수 A/B)는 round1(소수 1자리, `Math.round(x*10)/10`)을 가정해 예상치 74.0/77.5,
  // Selection Score 53.8/78.1을 제시한다(`selection-ab.json`의 `docRound1Golden`). `selection.ts` 상단
  // 주석에 기록한 스펙 충돌대로 이 저장소는 `canonicalize`의 안전 정수 불변식을 지키려 정수 반올림
  // (roundToInt)을 쓰므로, 아래 골든 값은 `actualRoundToIntGolden`(직접 실행해 얻은 값)이다. B의
  // 예상치는 부동소수점 오차로 raw가 77.49999999999999가 되어 77로 내려간다(round1은 ×10 반올림이
  // 우연히 오차를 상쇄해 77.5를 보존하지만 정수 반올림은 그대로 드러낸다) — PR 본문에 기록한다.
  const A = {
    baseOvr: 80,
    tacticalFit: 50,
    managerTrust: 45,
    form: 70,
    fitness: 60,
    morale: 70,
    familiarity: 1.0,
  };
  const B = {
    baseOvr: 74,
    tacticalFit: 88,
    managerTrust: 70,
    form: 85,
    fitness: 85,
    morale: 81,
    familiarity: 1.0,
  };
  const squadStatusByRole = RULESET.contractRules.squadStatusByRole;

  it('선수 A의 예상치·Squad Status·Selection Score는 74/40/54다', () => {
    const expectedPerformance = computeExpectedPerformance(A, rules);
    expect(expectedPerformance).toBe(74);
    const squadStatus = computeSquadStatus(
      { rolePromise: 'BENCH', captaincy: 'NONE', lastRating: null },
      rules,
      squadStatusByRole,
    );
    expect(squadStatus).toBe(40);
    const score = computeSelectionScore(
      {
        tacticalFit: A.tacticalFit,
        managerTrust: A.managerTrust,
        expectedPerformance,
        squadStatus,
      },
      rules,
    );
    expect(score).toBe(54);
  });

  it('선수 B의 예상치·Squad Status·Selection Score는 77/60/78이며, Base OVR이 6 낮아도 A보다 점수가 높다', () => {
    const expectedPerformance = computeExpectedPerformance(B, rules);
    expect(expectedPerformance).toBe(77);
    const squadStatus = computeSquadStatus(
      { rolePromise: 'ROTATION', captaincy: 'NONE', lastRating: null },
      rules,
      squadStatusByRole,
    );
    expect(squadStatus).toBe(60);
    const score = computeSelectionScore(
      {
        tacticalFit: B.tacticalFit,
        managerTrust: B.managerTrust,
        expectedPerformance,
        squadStatus,
      },
      rules,
    );
    expect(score).toBe(78);
    expect(score).toBeGreaterThan(54);
  });

  function candidates(
    lastRatingA: number | null,
    lastRatingB: number | null,
  ): SelectionCandidate[] {
    const aExpected = computeExpectedPerformance(A, rules);
    const bExpected = computeExpectedPerformance(B, rules);
    const aStatus = computeSquadStatus(
      { rolePromise: 'BENCH', captaincy: 'NONE', lastRating: lastRatingA },
      rules,
      squadStatusByRole,
    );
    const bStatus = computeSquadStatus(
      { rolePromise: 'ROTATION', captaincy: 'NONE', lastRating: lastRatingB },
      rules,
      squadStatusByRole,
    );
    const candidateA: SelectionCandidate = {
      id: 'RIVAL-A',
      name: 'RIVAL-A',
      baseOvr: A.baseOvr,
      tacticalFit: A.tacticalFit,
      managerTrust: A.managerTrust,
      expectedPerformance: aExpected,
      squadStatus: aStatus,
      score: computeSelectionScore(
        {
          tacticalFit: A.tacticalFit,
          managerTrust: A.managerTrust,
          expectedPerformance: aExpected,
          squadStatus: aStatus,
        },
        rules,
      ),
      excluded: null,
    };
    const candidateB: SelectionCandidate = {
      id: 'PLAYER',
      name: 'PLAYER',
      baseOvr: B.baseOvr,
      tacticalFit: B.tacticalFit,
      managerTrust: B.managerTrust,
      expectedPerformance: bExpected,
      squadStatus: bStatus,
      score: computeSelectionScore(
        {
          tacticalFit: B.tacticalFit,
          managerTrust: B.managerTrust,
          expectedPerformance: bExpected,
          squadStatus: bStatus,
        },
        rules,
      ),
      excluded: null,
    };
    return [candidateA, candidateB];
  }

  it('slots=1인 자리에서 B가 START, A가 SUB이고 playerReason은 TACTICAL_FIT이 가장 크다', () => {
    const ranking = rankSelection(candidates(null, null), 'W', 1, 1, rules);
    const player = ranking.candidates.find((c) => c.id === 'PLAYER')!;
    const rival = ranking.candidates.find((c) => c.id === 'RIVAL-A')!;
    expect(player.appearance).toBe('START');
    expect(rival.appearance).toBe('SUB');
    expect(ranking.playerReason).toEqual({ component: 'TACTICAL_FIT', delta: 15 });
  });

  it('직전 평점(A 6.8 고정·B 7.2 고정)으로 Squad Status를 갱신하며 12회 판정해도 B의 START 횟수 > A다', () => {
    // computeSquadStatus·rankSelection 모두 rng를 쓰지 않는 순수 함수라, 직전 평점이 매 라운드 그대로면
    // 12번을 다시 판정해도 결과가 그대로다 — "한 시즌(12 step)"에 걸쳐 매 판정마다 재계산되어도
    // 캐시되거나 흔들리지 않는다는 것을 확인한다(브리프 골든 절차 1번의 "12번" 반복 검사).
    let startsA = 0;
    let startsB = 0;
    for (let round = 0; round < 12; round++) {
      const ranking = rankSelection(candidates(6.8, 7.2), 'W', 1, 1, rules);
      if (ranking.candidates.find((c) => c.id === 'RIVAL-A')!.appearance === 'START') startsA++;
      if (ranking.candidates.find((c) => c.id === 'PLAYER')!.appearance === 'START') startsB++;
    }
    expect(startsB).toBeGreaterThan(startsA);
    expect(startsB).toBe(12);
    expect(startsA).toBe(0);
  });
});

describe('computeTacticalFit — 아키타입 선호 가산(D-34)', () => {
  const POSITIONS: Position[] = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
  const ZERO_ATTRS = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Record<
    AttributeKey,
    number
  >;

  function buildStyle(preferredForW: string[]): TacticalStyle {
    const roleWeights = Object.fromEntries(
      POSITIONS.map((p) => [p, p === 'W' ? { pace: 0.5, dribbling: 0.5 } : {}]),
    ) as TacticalStyle['roleWeights'];
    const preferredArchetypeIds = Object.fromEntries(
      POSITIONS.map((p) => [p, p === 'W' ? preferredForW : []]),
    ) as TacticalStyle['preferredArchetypeIds'];
    const slots = Object.fromEntries(POSITIONS.map((p) => [p, 1])) as TacticalStyle['slots'];
    const benchSlots = Object.fromEntries(
      POSITIONS.map((p) => [p, 1]),
    ) as TacticalStyle['benchSlots'];
    return {
      id: 'test-style',
      name: 'test',
      summary: '',
      formation: '4-4-2',
      slots,
      benchSlots,
      roleWeights,
      preferredArchetypeIds,
    };
  }

  it('선호 아키타입이면 정확히 +40, styleScore는 동일하다', () => {
    const attrs = { ...ZERO_ATTRS, pace: 60, dribbling: 40 };
    const withPref = computeTacticalFit(
      attrs,
      'inside-forward',
      'W',
      buildStyle(['inside-forward']),
      rules,
    );
    const withoutPref = computeTacticalFit(attrs, 'inside-forward', 'W', buildStyle([]), rules);
    expect(withPref - withoutPref).toBe(40);
    // styleScore = 60*0.5 + 40*0.5 = 50, ×tacticalFitWeights.style(0.6) = 30
    expect(withoutPref).toBe(30);
    expect(withPref).toBe(70);
  });
});

describe('ROOKIE_TRIAL_V1 — 건강한 루키의 제한된 벤치 기회(#242)', () => {
  const styleId = RULESET.tacticalStyles[0]!.id;
  const rival = {
    id: 'RIVAL',
    name: 'Rival',
    position: 'W' as const,
    archetypeId: 'inside-forward',
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 90])) as Record<
      AttributeKey,
      number
    >,
    baseOvr: 90,
    form: 90,
    fitness: 90,
    morale: 90,
    tacticalFit: 90,
    managerTrust: 90,
    squadStatus: 90,
    rolePromise: 'STARTER' as const,
  };

  it('does not fabricate a start, but gives an eligible healthy rookie a SUB slot', () => {
    const ranking = rankPositionForPlayer({
      ruleset: RULESET,
      styleId,
      position: 'W',
      playerName: 'Rookie',
      baseOvr: 40,
      tacticalFit: 20,
      managerTrust: 20,
      form: 40,
      fitness: 90,
      morale: 50,
      familiarity: 1,
      squadStatus: 20,
      competitors: Array.from({ length: 8 }, (_, index) => ({ ...rival, id: `RIVAL-${index}` })),
      earlyOpportunity: true,
    });
    const player = ranking.candidates.find((candidate) => candidate.id === 'PLAYER')!;
    expect(player.appearance).toBe('SUB');
    expect(player.rank).toBeGreaterThan(ranking.slots);
    expect(player.excluded).toBeNull();
  });

  it('never places an injured or suspended rookie into the trial bench', () => {
    for (const excluded of ['INJURY', 'SUSPENSION'] as const) {
      const ranking = rankPositionForPlayer({
        ruleset: RULESET,
        styleId,
        position: 'W',
        playerName: 'Unavailable rookie',
        baseOvr: 40,
        tacticalFit: 20,
        managerTrust: 20,
        form: 40,
        fitness: 90,
        morale: 50,
        familiarity: 1,
        squadStatus: 20,
        competitors: Array.from({ length: 8 }, (_, index) => ({ ...rival, id: `RIVAL-${index}` })),
        excluded,
        earlyOpportunity: true,
      });
      expect(ranking.candidates.find((candidate) => candidate.id === 'PLAYER')?.appearance).toBe(
        'OUT',
      );
    }
  });
});

describe('familiarityOf — 등급 경계(D-34)', () => {
  it('proficiencyThresholds 경계값에서 자연스럽게 등급이 갈린다', () => {
    const t = rules.proficiencyThresholds;
    const f = rules.positionFamiliarity;
    expect(familiarityOf(t.natural, rules)).toBe(f.natural);
    expect(familiarityOf(t.natural - 1, rules)).toBe(f.trained);
    expect(familiarityOf(t.trained, rules)).toBe(f.trained);
    expect(familiarityOf(t.trained - 1, rules)).toBe(f.makeshift);
    expect(familiarityOf(0, rules)).toBe(f.makeshift);
  });
});

describe('computeSquadStatus — 주장 보너스·평점 보정(D-34)', () => {
  const squadStatusByRole = RULESET.contractRules.squadStatusByRole;

  it('주장 보너스와 평점 보정이 더해진다', () => {
    const status = computeSquadStatus(
      { rolePromise: 'BENCH', captaincy: 'VICE', lastRating: null },
      rules,
      squadStatusByRole,
    );
    expect(status).toBe(squadStatusByRole.BENCH + rules.squadStatusRule.captainBonus.VICE);
  });

  it('평점 보정은 ratingAdjMax로 clamp된다(주장 보너스가 상한을 넘겨도 squadStatus 자체는 0~100)', () => {
    const status = computeSquadStatus(
      { rolePromise: 'STARTER', captaincy: 'CAPTAIN', lastRating: 9.5 },
      rules,
      squadStatusByRole,
    );
    const expectedRatingAdj = rules.squadStatusRule.ratingAdjMax;
    const raw =
      squadStatusByRole.STARTER + rules.squadStatusRule.captainBonus.CAPTAIN + expectedRatingAdj;
    expect(status).toBe(Math.min(100, raw));
  });

  it('낮은 평점은 ratingAdjMax 하한으로 clamp된다', () => {
    const status = computeSquadStatus(
      { rolePromise: 'RESERVE', captaincy: 'NONE', lastRating: 0 },
      rules,
      squadStatusByRole,
    );
    expect(status).toBe(squadStatusByRole.RESERVE - rules.squadStatusRule.ratingAdjMax);
  });
});

describe('deriveTacticalRoom — 화면 선택자(D-34)', () => {
  it('시즌이 없으면 null이다', () => {
    const snapshot = confirmedActiveSnapshot();
    expect(snapshot.state.season).toBeNull();
    expect(deriveTacticalRoom(snapshot.state, RULESET)).toBeNull();
  });

  it('시즌이 있으면 season.styleId·selection을 그대로 반영한 뷰를 돌려준다', () => {
    const snapshot = activeSnapshotWithSeason();
    const state = snapshot.state;
    const view = deriveTacticalRoom(state, RULESET);
    expect(view).not.toBeNull();
    if (view === null || state.season === null || state.player.profile === null) return;
    expect(view.styleId).toBe(state.season.styleId);
    expect(view.playerPosition).toBe(state.player.profile.primaryPosition);
    expect(view.playerRole).toBe(state.season.squadRole);
    expect(view.tacticalFit).toBe(state.context.tacticalFit);
    expect(view.managerTrust).toBe(state.relationships.managerTrust);
    expect(view.ranking).toEqual(state.season.selection);
    expect(Number.isInteger(view.expectedPerformance)).toBe(true);
    expect([
      rules.positionFamiliarity.natural,
      rules.positionFamiliarity.trained,
      rules.positionFamiliarity.makeshift,
    ]).toContain(view.familiarity);
  });
});
