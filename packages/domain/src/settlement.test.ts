import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { runSeasonFixture } from './__fixtures__/career-02-season.js';
import { runSettledFixture } from './__fixtures__/career-06-settled.js';
import { computePromiseFulfilment, hashSeasonResult } from './settlement.js';
import { hashState } from './hash.js';
import { simulate } from './simulate.js';
import type { CareerState, DomainSnapshot, SeasonResult } from './types.js';

// T-2-005 D-39: settlement.ts 단위/통합 테스트. buildSeasonResult는 career-02-season fixture(실제
// simulate() 재생, 이미 golden으로 결정론이 고정됨)를 그대로 써서 필드 채움·roleChanges 추출·
// stateDeltas.after == seasonBoundaryReset을 통합 레벨에서 확인한다. computePromiseFulfilment·
// hashSeasonResult는 값을 직접 넣어 경계·결정성을 정확히 확인한다.

describe('buildSeasonResult (career-02-season FAST 재생으로 통합 확인)', () => {
  const { snapshot } = runSeasonFixture('FAST');
  const result = snapshot.state.seasonHistory[0]?.result;
  if (result === undefined) throw new Error('setup 실패: seasonHistory[0].result가 없다.');

  it('SeasonResult 필드가 시즌 실제 값으로 채워진다', () => {
    expect(result.index).toBe(1);
    expect(result.simulationMode).toBe('FAST');
    expect(result.teamId.length).toBeGreaterThan(0);
    expect(result.competitions.length).toBeGreaterThan(0);
    expect(result.playerStats.appearances.total).toBeGreaterThan(0);
    expect(result.selectionSummary.minutes).toBe(result.playerStats.minutes);
    expect(result.selectionSummary.possibleMinutes).toBeGreaterThan(0);
    expect(result.selectionSummary.finalRank).toBeGreaterThan(0);
    expect(result.chapters).toEqual([]);
    expect(result.hash.length).toBeGreaterThan(0);
  });

  it('roleChanges는 이번 시즌 timeline의 ROLE_RESOLVED에서 refId(type:decision)로 추출된다', () => {
    expect(result.roleChanges).toHaveLength(1);
    expect(result.roleChanges[0]).toMatchObject({ step: 1, decision: 'ACCEPT' });
    expect(['KEEP', 'POSITION_CHANGE', 'ROLE_CHANGE']).toContain(result.roleChanges[0]!.type);
  });

  it('stateDeltas.after는 ruleset.seasonBoundaryReset과 같다', () => {
    expect(result.stateDeltas.form.after).toBe(rulesetProto.seasonBoundaryReset.form);
    expect(result.stateDeltas.fitness.after).toBe(rulesetProto.seasonBoundaryReset.fitness);
    expect(result.stateDeltas.morale.after).toBe(rulesetProto.seasonBoundaryReset.morale);
  });

  it('결산에서 추가한 관계 timeline revision은 snapshot revision을 넘지 않는다', () => {
    const maxTimelineRevision = Math.max(
      ...snapshot.state.timeline.map((entry) => entry.revision),
      0,
    );
    expect(maxTimelineRevision).toBeLessThanOrEqual(snapshot.revision);
  });

  it('production SETTLE_SEASON은 CAPTAIN_APPOINTED·MANAGER_CHANGED를 결산 revision에 기록한다', () => {
    const fixture = runSettledFixture();
    const source = fixture.beforeSettlementState;
    const currentSeason = source.season;
    if (currentSeason === null) throw new Error('setup 실패: 결산 전 season이 없다.');
    const prior = snapshot.state.seasonHistory[0];
    if (prior === undefined) throw new Error('setup 실패: synthetic prior result가 없다.');
    const teamId = source.contract?.teamId;
    if (teamId === undefined) throw new Error('setup 실패: contract.teamId가 없다.');
    const seasonHistory = [1, 2, 3].map((index) => ({
      ...prior,
      index,
      teamId,
      result: { ...prior.result, index, teamId },
    }));
    const state: CareerState = {
      ...source,
      season: { ...currentSeason, index: 4, squadRole: 'STARTER', squadRoleAtStart: 'STARTER' },
      seasonHistory,
      captaincy: 'NONE' as const,
      captaincySeasons: 0,
      nextManager: null,
      relationships: { ...source.relationships, captain: 100, managerTrust: 91 },
    };
    const baseSnapshot: DomainSnapshot = {
      ...fixture.snapshot,
      revision: fixture.snapshot.revision - 1,
      state,
      stateHash: hashState(state),
    };
    const forcedChangeRuleset = {
      ...rulesetProto,
      managerRules: {
        ...rulesetProto.managerRules,
        changeProbability: {
          ...rulesetProto.managerRules.changeProbability,
          baseBp: 10000,
          maxBp: 10000,
        },
      },
    };
    const settled = simulate({
      snapshot: baseSnapshot,
      command: {
        type: 'SETTLE_SEASON',
        commandId: 'settlement-revision-production',
        expectedRevision: baseSnapshot.revision,
        payload: {},
      },
      ruleset: forcedChangeRuleset,
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.1.0',
    });

    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    const relationEntries = settled.snapshot.state.timeline.filter(
      (entry) => entry.kind === 'CAPTAIN_APPOINTED' || entry.kind === 'MANAGER_CHANGED',
    );
    expect(relationEntries.map((entry) => entry.kind)).toEqual([
      'CAPTAIN_APPOINTED',
      'MANAGER_CHANGED',
    ]);
    expect(relationEntries.every((entry) => entry.revision === settled.snapshot.revision)).toBe(
      true,
    );
    expect(
      Math.max(...settled.snapshot.state.timeline.map((entry) => entry.revision), 0),
    ).toBeLessThanOrEqual(settled.snapshot.revision);
  });
});

describe('computePromiseFulfilment', () => {
  const shareTable: Record<'STARTER' | 'ROTATION' | 'BENCH' | 'RESERVE', number> = {
    STARTER: 6500,
    ROTATION: 4000,
    BENCH: 1500,
    RESERVE: 0,
  };

  it('minutesShareBp이 정확히 6500이면 STARTER를 이행한 것으로 판정한다', () => {
    // 6500/10000 = minutes/possibleMinutes → minutes=6500, possibleMinutes=10000이면 정확히 경계.
    const result = computePromiseFulfilment('BENCH', 6500, 10000, shareTable);
    expect(result.minutesShareBp).toBe(6500);
    expect(result.delivered).toBe('STARTER');
    expect(result.fulfilled).toBe(true);
  });

  it('경계보다 1bp 낮으면(6499) ROTATION으로 내려간다', () => {
    const result = computePromiseFulfilment('STARTER', 6499, 10000, shareTable);
    expect(result.minutesShareBp).toBe(6499);
    expect(result.delivered).toBe('ROTATION');
    expect(result.fulfilled).toBe(false);
  });

  it('possibleMinutes가 0이면 minutesShareBp도 0이고 RESERVE로 떨어진다', () => {
    const result = computePromiseFulfilment('BENCH', 0, 0, shareTable);
    expect(result.minutesShareBp).toBe(0);
    expect(result.delivered).toBe('RESERVE');
    expect(result.fulfilled).toBe(false);
  });

  it('delivered가 promised와 같은 역할이면 이행이다', () => {
    const result = computePromiseFulfilment('ROTATION', 4000, 10000, shareTable);
    expect(result.delivered).toBe('ROTATION');
    expect(result.fulfilled).toBe(true);
  });
});

describe('hashSeasonResult', () => {
  function sampleResult(): SeasonResult {
    return {
      index: 1,
      simulationMode: 'FAST',
      teamId: 'team-1',
      managerId: 'team-1-mgr-1',
      captaincyAtEnd: 'NONE',
      competitions: [],
      playerStats: {
        group: 'MF',
        appearances: { total: 1, started: 1, sub: 0, zeroMinute: 0, out: 0 },
        minutes: 90,
        ratingSumTenths: 70,
        ratedMatches: 1,
        yellow: 0,
        red: 0,
        injuries: 0,
        totals: {
          group: 'MF',
          assists: 0,
          chancesCreated: 0,
          progressivePasses: 0,
          passesAttempted: 0,
          passesCompleted: 0,
          ballRecoveries: 0,
        },
      },
      selectionSummary: {
        squadRoleAtStart: 'ROTATION',
        squadRoleAtEnd: 'ROTATION',
        started: 1,
        sub: 0,
        zeroMinute: 0,
        out: 0,
        minutes: 90,
        possibleMinutes: 900,
        finalRank: 1,
      },
      roleChanges: [{ step: 1, type: 'KEEP', decision: 'ACCEPT' }],
      promiseFulfilment: {
        promised: 'ROTATION',
        delivered: 'ROTATION',
        fulfilled: true,
        minutesShareBp: 1000,
      },
      attributeDeltas: [{ key: 'shooting', delta: 1, causes: [{ cause: 'TRAINING', centi: 120 }] }],
      baseOvr: { before: 50, after: 51 },
      stateDeltas: {
        form: { before: 50, after: 50 },
        fitness: { before: 80, after: 80 },
        morale: { before: 50, after: 60 },
        managerTrust: { before: 45, after: 45 },
      },
      chapters: [],
      stepSummaries: [
        { step: 1, phase: 'LEAGUE', matchesPlayed: 1, decisionsOpened: 1, passedAtRevision: 2 },
      ],
      hash: '',
    };
  }

  it('같은 값이면 항상 같은 hash를 만든다(hash 필드 자체는 무시한다)', () => {
    const a = sampleResult();
    const b = { ...sampleResult(), hash: 'ignored-different-string' };
    expect(hashSeasonResult(a)).toBe(hashSeasonResult(a));
    expect(hashSeasonResult(a)).toBe(hashSeasonResult(b));
  });

  it('필드 하나만 달라도 hash가 달라진다', () => {
    const base = sampleResult();
    const changed = { ...base, baseOvr: { before: 50, after: 52 } };
    expect(hashSeasonResult(base)).not.toBe(hashSeasonResult(changed));
  });
});
