// SCR-015 CompareCards 순수 함수 단위 테스트(브리프 10번): 지난 시즌/계약 약속 세그먼트의 행 생성과
// "차이만 보기" 필터를 검증한다. 렌더링(세그먼트 전환 UI)은 e2e/season-result.spec.ts가 다룬다.
import type { SeasonResult } from '@offside/domain';
import { describe, expect, it } from 'vitest';
import { availableCompareTargets, buildCompareRows, filterCompareRows } from './season-compare.js';
import type { SeasonResultView } from './season-result-view.js';

function seasonResult(overrides: Partial<SeasonResult> = {}): SeasonResult {
  return {
    index: 1,
    simulationMode: 'FAST',
    teamId: 'seorabeol-united',
    managerId: 'seorabeol-united-mgr-1',
    captaincyAtEnd: 'NONE',
    competitions: [],
    playerStats: {
      group: 'FW',
      appearances: { total: 20, started: 18, sub: 2, zeroMinute: 0, out: 0 },
      minutes: 1600,
      ratingSumTenths: 20 * 70,
      ratedMatches: 20,
      yellow: 1,
      red: 0,
      injuries: 0,
      totals: { group: 'FW', goals: 10, assists: 3, xgCenti: 800, shots: 30, offsides: 4 },
    },
    selectionSummary: { squadRoleAtStart: 'ROTATION', squadRoleAtEnd: 'STARTER', started: 18, sub: 2, zeroMinute: 0, out: 0, minutes: 1600, possibleMinutes: 2000, finalRank: 3 },
    roleChanges: [],
    promiseFulfilment: { promised: 'ROTATION', delivered: 'STARTER', fulfilled: true, minutesShareBp: 8000 },
    attributeDeltas: [],
    baseOvr: { before: 60, after: 62 },
    stateDeltas: {
      form: { before: 50, after: 50 },
      fitness: { before: 80, after: 80 },
      morale: { before: 60, after: 60 },
      managerTrust: { before: 40, after: 40 },
    },
    chapters: [],
    stepSummaries: [],
    hash: 'hash-a',
    ...overrides,
  };
}

function view(overrides: Partial<SeasonResultView> = {}): SeasonResultView {
  const result = seasonResult();
  return {
    historyIndex: 1,
    seasonNumber: 2,
    isYouth: false,
    teamId: result.teamId,
    common: {
      started: 18,
      sub: 2,
      zeroMinute: 0,
      out: 0,
      total: 20,
      minutes: 1600,
      avgRatingTenths: 70,
      yellow: 1,
      red: 0,
      injuries: 0,
    },
    positionCard: { group: 'FW', goals: 10, assists: 3, xgCenti: 800, shots: 30, offsides: 4 },
    teamRecords: [],
    selection: { roleAtStart: 'ROTATION', roleAtEnd: 'STARTER', finalRank: 3, minutes: 1600, possibleMinutes: 2000 },
    promise: result.promiseFulfilment,
    promiseThresholdBp: 6500,
    roleChanges: [],
    chapters: [],
    attributeDeltaGroups: [],
    baseOvr: result.baseOvr,
    topCause: null,
    stateDeltas: result.stateDeltas,
    scoutedPotentialMin: 60,
    scoutedPotentialMax: 75,
    hash: result.hash,
    result,
    previousResult: null,
    ...overrides,
  };
}

describe('availableCompareTargets', () => {
  it('지난 시즌 결과가 없으면(첫 시즌) 계약 약속만 있다', () => {
    expect(availableCompareTargets(view({ previousResult: null }))).toEqual(['PROMISE']);
  });

  it('지난 시즌 결과가 있으면 지난 시즌을 먼저, 계약 약속을 나중에 둔다', () => {
    const previous = seasonResult({ index: 1, hash: 'hash-prev' });
    expect(availableCompareTargets(view({ previousResult: previous }))).toEqual(['PREVIOUS_SEASON', 'PROMISE']);
  });
});

describe('buildCompareRows(PROMISE)', () => {
  it('역할·출전 비율 두 행을 만든다', () => {
    const rows = buildCompareRows(view(), 'PROMISE');
    expect(rows).toEqual([
      { id: 'role', label: '역할', baselineText: '주전', comparisonText: '로테이션', same: false },
      { id: 'minutesShare', label: '출전 비율', baselineText: '80%', comparisonText: '65% 이상', same: false },
    ]);
  });

  it('약속과 실제가 같으면 same이 true다', () => {
    const current = view({
      promise: { promised: 'STARTER', delivered: 'STARTER', fulfilled: true, minutesShareBp: 6500 },
      promiseThresholdBp: 6500,
    });
    const rows = buildCompareRows(current, 'PROMISE');
    expect(rows.every((row) => row.same)).toBe(true);
  });
});

describe('buildCompareRows(PREVIOUS_SEASON)', () => {
  it('지난 시즌이 없으면 빈 배열이다', () => {
    expect(buildCompareRows(view({ previousResult: null }), 'PREVIOUS_SEASON')).toEqual([]);
  });

  it('출전·분·평균 평점·Base OVR 4행을 만들고 다른 값은 same:false다', () => {
    const previous = seasonResult({ index: 1, hash: 'hash-prev' });
    const rows = buildCompareRows(view({ previousResult: previous }), 'PREVIOUS_SEASON');
    expect(rows.map((row) => row.id)).toEqual(['appearances', 'minutes', 'avgRating', 'baseOvr']);
    expect(rows.every((row) => row.same)).toBe(true); // 이 픽스처는 지난 시즌과 값이 모두 같다.
  });

  it('지난 시즌 평점이 미집계(ratedMatches 0)면 "—"로 비교한다', () => {
    const previous = seasonResult({
      index: 1,
      hash: 'hash-prev',
      playerStats: { ...seasonResult().playerStats, ratedMatches: 0, ratingSumTenths: 0 },
    });
    const rows = buildCompareRows(view({ previousResult: previous }), 'PREVIOUS_SEASON');
    const avgRatingRow = rows.find((row) => row.id === 'avgRating');
    expect(avgRatingRow).toMatchObject({ comparisonText: '—', same: false });
  });
});

describe('filterCompareRows', () => {
  it('diffOnly가 false면 그대로 돌려준다', () => {
    const rows = buildCompareRows(view(), 'PROMISE');
    expect(filterCompareRows(rows, false)).toEqual(rows);
  });

  it('diffOnly가 true면 같은 값(same:true) 행을 숨긴다', () => {
    const current = view({
      promise: { promised: 'ROTATION', delivered: 'STARTER', fulfilled: true, minutesShareBp: 6500 },
      promiseThresholdBp: 6500,
    });
    const rows = buildCompareRows(current, 'PROMISE');
    const filtered = filterCompareRows(rows, true);
    expect(filtered.map((row) => row.id)).toEqual(['role']);
  });
});
