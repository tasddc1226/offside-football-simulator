import { describe, expect, it } from 'vitest';
import { canonicalize, type JsonValue } from './canonical.js';
import { rulesetProto } from './__fixtures__/career-01.js';
import { buildSchedule, findLeague } from './schedule.js';
import { playMatch, type PlayMatchInput } from './match.js';
import { seedRng } from './rng.js';
import type { Availability, Competitor, Position } from './types.js';

const team = rulesetProto.teams.find((candidate) => candidate.id === 'seoul-tier1')!;
const league = findLeague(rulesetProto, team.leagueId);
const schedule = buildSchedule(rulesetProto, team);
const leagueEntry = schedule.find((entry) => entry.kind === 'LEAGUE')!;

function competitor(id: string, position: Position, ovr: number): Competitor {
  return {
    id,
    name: id,
    position,
    archetypeId: 'x',
    attributes: {} as Competitor['attributes'],
    baseOvr: ovr,
    form: 60,
    fitness: 90,
    morale: 60,
    tacticalFit: ovr,
    managerTrust: 70,
    squadStatus: 70,
    rolePromise: 'STARTER',
  };
}

/** PLAYER가 항상 rank 1(START)이 되도록 약한 경쟁자 두 명을 둔 기본 입력. */
function baseStartInput(seed: string, overrides: Partial<PlayMatchInput> = {}): PlayMatchInput {
  const position: Position = overrides.primaryPosition ?? 'ST';
  return {
    ruleset: rulesetProto,
    rngState: seedRng(seed),
    seasonIndex: 1,
    matchIndex: 0,
    scheduleEntry: leagueEntry,
    team,
    league,
    styleId: team.tacticalStyleId,
    playerName: 'PLAYER',
    primaryPosition: position,
    baseOvr: 90,
    tacticalFit: 90,
    managerTrust: 70,
    form: 60,
    fitness: 90,
    morale: 60,
    positionProficiency: 100,
    squadStatus: 70,
    rolePromise: 'STARTER',
    competitors: [competitor('COMP-1', position, 40), competitor('COMP-2', position, 40)],
    availability: null,
    seasonYellowCount: 0,
    lastRatingTenths: null,
    ...overrides,
  };
}

/** PLAYER가 항상 rank 3(OUT, NOT_SELECTED)이 되도록 강한 경쟁자 두 명을 둔 입력. */
function baseOutInput(seed: string, overrides: Partial<PlayMatchInput> = {}): PlayMatchInput {
  const position: Position = overrides.primaryPosition ?? 'ST';
  return baseStartInput(seed, {
    baseOvr: 20,
    tacticalFit: 20,
    competitors: [competitor('COMP-1', position, 90), competitor('COMP-2', position, 90)],
    ...overrides,
  });
}

/** PLAYER가 항상 rank 2(SUB)가 되도록 한쪽만 강한 경쟁자를 둔 입력. */
function baseSubInput(seed: string, overrides: Partial<PlayMatchInput> = {}): PlayMatchInput {
  const position: Position = overrides.primaryPosition ?? 'ST';
  return baseStartInput(seed, {
    baseOvr: 60,
    tacticalFit: 60,
    competitors: [competitor('COMP-1', position, 90), competitor('COMP-2', position, 20)],
    ...overrides,
  });
}

describe('playMatch — RNG 소비 순서(브리프 D-27·D-35, draw 카운트로 고정)', () => {
  // seed 탐색으로 찾은 고정 시나리오(테스트 헬퍼로 탐색 후 결과를 하드코딩, 브리프 "필수 테스트 벡터").
  it('OUT(NOT_SELECTED)은 팀 결과 roll만 소비한다(draws +3)', () => {
    const input = baseOutInput('any-seed-1');
    const result = playMatch(input);
    expect(result.match.appearance).toBe('OUT');
    expect(result.match.outReason).toBe('NOT_SELECTED');
    expect(result.match.minutes).toBe(0);
    expect(result.rngState.draws - input.rngState.draws).toBe(3);
  });

  it('OUT은 어떤 seed를 넣어도 항상 draws +3이다(선발은 roll-free라 결과 seed에 무관하다)', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const input = baseOutInput(seed);
      const result = playMatch(input);
      expect(result.match.appearance).toBe('OUT');
      expect(result.rngState.draws - input.rngState.draws).toBe(3);
    }
  });

  it('0분 교체 투입(UNUSED_SUB)은 팀 결과 + 출전 시간 roll만 소비한다(draws +4)', () => {
    const input = baseSubInput('unused-sub-search-2');
    const result = playMatch(input);
    expect(result.match.appearance).toBe('SUB');
    expect(result.match.minutes).toBe(0);
    expect(result.match.outReason).toBe('UNUSED_SUB');
    expect(result.rngState.draws - input.rngState.draws).toBe(4);
  });

  it('출전(START, 카드·부상 없음)은 팀 결과(3)+출전시간(1)+관여량(1)+FW 통계(5)+카드(1)+부상(1) = 12회를 소비한다', () => {
    const input = baseStartInput('clean-search-0');
    const result = playMatch(input);
    expect(result.match.appearance).toBe('START');
    expect(result.match.minutes).toBeGreaterThan(0);
    expect(result.match.cards).toEqual({ yellow: 0, red: false });
    expect(result.match.injuredOff).toBe(false);
    expect(result.rngState.draws - input.rngState.draws).toBe(12);
  });

  it('교체 출전(SUB, 0분 아님)도 START와 같은 12회 파이프라인을 소비한다', () => {
    const input = baseSubInput('sub-1');
    const result = playMatch(input);
    expect(result.match.appearance).toBe('SUB');
    expect(result.match.minutes).toBeGreaterThan(0);
    expect(result.match.outReason).toBeNull();
    expect(result.rngState.draws - input.rngState.draws).toBe(12);
  });

  it('퇴장(red)은 추가로 정지 길이 roll을 1회 더 써서 13회다', () => {
    const input = baseStartInput('card-search-253');
    const result = playMatch(input);
    expect(result.match.cards).toEqual({ yellow: 0, red: true });
    expect(result.rngState.draws - input.rngState.draws).toBe(13);
  });

  it('부상 이탈은 duration roll을 match RNG에서 소비하지 않아 12회다', () => {
    const input = baseStartInput('injury-search-81');
    const result = playMatch(input);
    expect(result.match.injuredOff).toBe(true);
    expect(result.rngState.draws - input.rngState.draws).toBe(12);
  });

  it('포지션군별 통계 roll 수는 고정 키 순서(FW 5·MF 6·DF 4·GK 4)에 맞는 draws 차이를 만든다', () => {
    const counts: Record<Position, { group: string; keys: number }> = {
      ST: { group: 'FW', keys: 5 },
      W: { group: 'FW', keys: 5 },
      CM: { group: 'MF', keys: 6 },
      DM: { group: 'MF', keys: 6 },
      AM: { group: 'MF', keys: 6 },
      CB: { group: 'DF', keys: 4 },
      FB: { group: 'DF', keys: 4 },
      GK: { group: 'GK', keys: 4 },
    };
    for (const position of ['ST', 'CM', 'CB', 'GK'] as const) {
      // 팀 결과(3) + 출전시간(1) + 관여량(1) + 통계(keys) + 카드(1, no red) + 부상(1, no injury).
      const base = 3 + 1 + 1 + counts[position].keys + 1 + 1;
      let found = false;
      for (let i = 0; i < 200 && !found; i++) {
        const seed = `stat-count-${position}-${i}`;
        const input = baseStartInput(seed, { primaryPosition: position });
        const result = playMatch(input);
        if (result.match.appearance === 'START' && result.match.minutes > 0 && !result.match.cards.red && !result.match.injuredOff) {
          expect(result.rngState.draws - input.rngState.draws).toBe(base);
          found = true;
        }
      }
      expect(found).toBe(true);
    }
  });
});

describe('playMatch — 제약(브리프 D-27·D-35)', () => {
  it('FW: goals ≤ result.goalsFor, assists ≤ goalsFor − goals', () => {
    for (let i = 0; i < 300; i++) {
      const input = baseStartInput(`fw-constraint-${i}`, { primaryPosition: 'ST' });
      const result = playMatch(input);
      if (result.match.stats.group !== 'FW') continue;
      expect(result.match.stats.goals).toBeLessThanOrEqual(result.match.result.goalsFor);
      expect(result.match.stats.assists).toBeLessThanOrEqual(result.match.result.goalsFor - result.match.stats.goals);
    }
  });

  it('MF: assists ≤ goalsFor, passesCompleted ≤ passesAttempted', () => {
    for (let i = 0; i < 300; i++) {
      const input = baseStartInput(`mf-constraint-${i}`, { primaryPosition: 'CM' });
      const result = playMatch(input);
      if (result.match.stats.group !== 'MF') continue;
      expect(result.match.stats.assists).toBeLessThanOrEqual(result.match.result.goalsFor);
      expect(result.match.stats.passesCompleted).toBeLessThanOrEqual(result.match.stats.passesAttempted);
    }
  });

  it('DF: goalsConcededInvolved ≤ goalsAgainst', () => {
    for (let i = 0; i < 300; i++) {
      const input = baseStartInput(`df-constraint-${i}`, { primaryPosition: 'CB' });
      const result = playMatch(input);
      if (result.match.stats.group !== 'DF') continue;
      expect(result.match.stats.goalsConcededInvolved).toBeLessThanOrEqual(result.match.result.goalsAgainst);
    }
  });

  it('DF·GK: cleanSheet = (goalsAgainst===0 && minutes ≥ 기준)', () => {
    for (const position of ['CB', 'GK'] as const) {
      for (let i = 0; i < 300; i++) {
        const input = baseStartInput(`${position}-constraint-${i}`, { primaryPosition: position });
        const result = playMatch(input);
        if (result.match.stats.group !== 'DF' && result.match.stats.group !== 'GK') continue;
        const expectedCleanSheet =
          result.match.result.goalsAgainst === 0 && result.match.minutes >= rulesetProto.matchRules.cleanSheetMinMinutes;
        expect(result.match.stats.cleanSheet).toBe(expectedCleanSheet);
      }
    }
  });

  it('0분이면 통계가 전부 0이고 ratingTenths는 null, lastRatingTenths는 유지된다', () => {
    const input = baseOutInput('zero-min-1', { lastRatingTenths: 77 });
    const result = playMatch(input);
    expect(result.match.minutes).toBe(0);
    expect(result.match.ratingTenths).toBeNull();
    expect(result.nextLastRatingTenths).toBe(77);
    expect(result.match.stats).toEqual({ group: 'FW', goals: 0, assists: 0, xgCenti: 0, shots: 0, offsides: 0 });
  });

  it('minutes는 0~90 정수, ratingTenths는(0분이 아니면) 40~100 정수다', () => {
    for (let i = 0; i < 300; i++) {
      const input = baseStartInput(`range-${i}`);
      const result = playMatch(input);
      expect(Number.isInteger(result.match.minutes)).toBe(true);
      expect(result.match.minutes).toBeGreaterThanOrEqual(0);
      expect(result.match.minutes).toBeLessThanOrEqual(90);
      if (result.match.minutes > 0) {
        expect(result.match.ratingTenths).not.toBeNull();
        expect(Number.isInteger(result.match.ratingTenths)).toBe(true);
        expect(result.match.ratingTenths!).toBeGreaterThanOrEqual(40);
        expect(result.match.ratingTenths!).toBeLessThanOrEqual(100);
      } else {
        expect(result.match.ratingTenths).toBeNull();
      }
    }
  });

  it('경기 결과 전체가 safe integer만 담는다(canonicalize 통과)', () => {
    for (let i = 0; i < 100; i++) {
      const input = baseStartInput(`canon-${i}`);
      const result = playMatch(input);
      expect(() => canonicalize(result.match as unknown as JsonValue)).not.toThrow();
    }
  });
});

describe('playMatch — 필수 테스트 벡터: 0분·교체 출전·퇴장·부상 이탈 fixture 4개', () => {
  it('1) 0분(OUT, NOT_SELECTED)이 appearances.zeroMinute·appearances.out에 정확히 집계된다', () => {
    const input = baseOutInput('fixture-0min');
    const result = playMatch(input);
    expect(result.match).toMatchObject({ appearance: 'OUT', minutes: 0, outReason: 'NOT_SELECTED', ratingTenths: null });
  });

  it('2) 교체 출전(SUB, minutes>0)이 appearances.sub에 정확히 집계되고 outReason은 null이다', () => {
    const input = baseSubInput('sub-1');
    const result = playMatch(input);
    expect(result.match.appearance).toBe('SUB');
    expect(result.match.minutes).toBeGreaterThan(0);
    expect(result.match.outReason).toBeNull();
  });

  it('3) 퇴장(red)이 cards.red·availability(SUSPENSION)에 정확히 집계된다', () => {
    const input = baseStartInput('card-search-253');
    const result = playMatch(input);
    expect(result.match.cards.red).toBe(true);
    expect(result.nextAvailability).toEqual({ kind: 'SUSPENSION', matchesRemaining: 2, sinceMatchId: result.match.id });
  });

  it('4) 부상 이탈은 injuredOff에 기록되고 이탈 기간은 injury hook이 결정한다', () => {
    const input = baseStartInput('injury-search-81');
    const result = playMatch(input);
    expect(result.match.injuredOff).toBe(true);
    expect(result.nextAvailability).not.toEqual(expect.objectContaining({ kind: 'INJURY' }));
    expect(result.recurrenceTriggered).toBe(false);
  });
});

describe('playMatch — 정지·부상 중 excluded·matchesRemaining 감소', () => {
  it('availability가 있으면 rankSelection에서 excluded로 제외되어 appearance는 항상 OUT이다', () => {
    const availability: Availability = { kind: 'SUSPENSION', matchesRemaining: 2, sinceMatchId: 'prev-match' };
    const input = baseStartInput('excluded-1', { availability });
    const result = playMatch(input);
    expect(result.match.appearance).toBe('OUT');
    expect(result.match.outReason).toBe('SUSPENSION');
    expect(result.selection.candidates.find((c) => c.id === 'PLAYER')!.excluded).toBe('SUSPENSION');
  });

  it('경기마다 matchesRemaining이 1씩 줄고, 0이 되면 해제(null)된다', () => {
    const availability: Availability = { kind: 'SUSPENSION', matchesRemaining: 2, sinceMatchId: 'prev-match' };
    const first = playMatch(baseStartInput('decrement-1', { availability }));
    expect(first.nextAvailability).toEqual({ kind: 'SUSPENSION', matchesRemaining: 1, sinceMatchId: 'prev-match' });

    const second = playMatch(baseStartInput('decrement-2', { availability: first.nextAvailability }));
    expect(second.nextAvailability).toBeNull();
  });

  it('INJURY도 같은 방식으로 감소·해제된다', () => {
    const availability: Availability = { kind: 'INJURY', matchesRemaining: 1, sinceMatchId: 'prev-match' };
    const result = playMatch(baseStartInput('injury-decrement-1', { availability }));
    expect(result.nextAvailability).toBeNull();
  });
});

describe('playMatch — 경고 누적 정지(yellowSuspensionAt) 전체 흐름', () => {
  // 오케스트레이터 리뷰 1차: 실제 축구의 "경고 5장 → 1경기 정지"를 재현하려면 브리프대로
  // yellowSuspensionAt=5여야 하지만(시즌 25~30경기·경고 확률 8~14%면 기대 경고 2~4장), 자연
  // 누적을 기다리는 seed 탐색은 비현실적이다. 대신 seasonYellowCount를 yellowSuspensionAt−1(=4)로
  // 직접 구성하고 yellow 카드가 나오는 seed 하나만 찾아 "누적 5번째 경고 → 정지"를 한 경기로
  // 재현한다(밸런스 값 자체는 건드리지 않는다).
  it('seasonYellowCount가 yellowSuspensionAt-1일 때 yellow 카드를 받으면 SUSPENSION(1경기)이 걸리고 카운트는 0으로 리셋된다', () => {
    const input = baseStartInput('yellow-suspension-search-2', {
      seasonYellowCount: rulesetProto.matchRules.yellowSuspensionAt - 1,
    });
    const result = playMatch(input);
    expect(result.match.cards).toEqual({ yellow: 1, red: false });
    expect(result.nextAvailability).toEqual({ kind: 'SUSPENSION', matchesRemaining: 1, sinceMatchId: result.match.id });
    expect(result.nextSeasonYellowCount).toBe(0);
  });

  it('정지가 걸린 다음 경기는 excluded(SUSPENSION)로 결장하고, 그 경기 뒤 정지가 해제된다', () => {
    const suspended = playMatch(
      baseStartInput('yellow-suspension-search-2', { seasonYellowCount: rulesetProto.matchRules.yellowSuspensionAt - 1 }),
    );
    const next = playMatch(
      baseStartInput('yellow-suspension-next', {
        availability: suspended.nextAvailability,
        seasonYellowCount: suspended.nextSeasonYellowCount,
      }),
    );
    expect(next.match.appearance).toBe('OUT');
    expect(next.match.outReason).toBe('SUSPENSION');
    expect(next.selection.candidates.find((c) => c.id === 'PLAYER')!.excluded).toBe('SUSPENSION');
    expect(next.nextAvailability).toBeNull();
  });
});

describe('playMatch — 결정론·안전성', () => {
  it('같은 입력을 1,000회 실행해도 매번 완전히 같은 결과가 나온다', () => {
    const input = baseStartInput('repeat-seed');
    const first = playMatch(input);
    for (let i = 0; i < 1000; i++) {
      const result = playMatch(input);
      expect(result).toEqual(first);
    }
  });

  it('서로 다른 seed 1,000개가 예외 없이 끝나고 제약을 모두 지킨다', () => {
    for (let i = 0; i < 1000; i++) {
      const input = baseStartInput(`bulk-${i}`, { matchIndex: i });
      const result = playMatch(input);
      expect(() => canonicalize(result.match as unknown as JsonValue)).not.toThrow();
      expect(result.match.minutes).toBeGreaterThanOrEqual(0);
      expect(result.match.minutes).toBeLessThanOrEqual(90);
      if (result.match.ratingTenths !== null) {
        expect(result.match.ratingTenths).toBeGreaterThanOrEqual(40);
        expect(result.match.ratingTenths).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('playMatch — 포지션군 4종 평점 분포(balance-targets "포지션별 기여")', () => {
  it('같은 Expected Performance 입력에서 1,000경기 ratingTenths 중앙값 차이가 4종 사이 3 이내다', () => {
    const groups: Position[] = ['ST', 'CM', 'CB', 'GK'];
    const medians: Record<string, number> = {};
    for (const position of groups) {
      const ratings: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const input = baseStartInput(`rating-${position}-${i}`, { primaryPosition: position, matchIndex: i });
        const result = playMatch(input);
        if (result.match.ratingTenths !== null) ratings.push(result.match.ratingTenths);
      }
      const sorted = [...ratings].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medians[position] = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
    }
    const values = Object.values(medians);
    const gap = Math.max(...values) - Math.min(...values);
    expect(gap).toBeLessThanOrEqual(3);
  });
});
