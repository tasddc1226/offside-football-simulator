import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-08-mf.golden.json';
import { runMfFixture } from './__fixtures__/career-08-mf.js';
import { verifySnapshot } from './simulate.js';

// T-2-011 1번: MF 포지션군(AM 아키타입 `am-playmaker`) fixture. FAST 모드로 CREATE_CAREER부터
// SETTLE_SEASON까지 실제 룰셋 1.0.0·팩 0.1.0으로 완주한다. 'possession' 전술 스타일은 AM
// slots이 0이라(팀 seoul-tier1) 경쟁자 2명+선수 3명 중 최소 2명이 매 경기 OUT — NOT_SELECTED
// 사례를 이 fixture가 담당한다(season-aggregation.test.ts 참고).
describe('career-08-mf fixture 결정론(MF 포지션군, AM 아키타입)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runMfFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 MF 통계(패스·찬스 생성·평균 평점·대회 기록)가 golden과 같다', () => {
    const { beforeSettlement } = runMfFixture();
    expect({
      matchesPlayed: beforeSettlement.matchesPlayed,
      playerStats: beforeSettlement.playerStats,
      averageRatingTenths: beforeSettlement.averageRatingTenths,
      competitions: beforeSettlement.competitions,
    }).toEqual(golden.beforeSettlement);
  });

  it('MF 전용 통계가 실제로 집계된다(0이면 이 fixture의 의미가 없다)', () => {
    const { beforeSettlement } = runMfFixture();
    const totals = beforeSettlement.playerStats.totals as {
      passesAttempted: number;
      passesCompleted: number;
      chancesCreated: number;
    };
    expect(totals.passesAttempted).toBeGreaterThan(0);
    expect(totals.passesCompleted).toBeGreaterThan(0);
    expect(totals.chancesCreated).toBeGreaterThan(0);
    expect(beforeSettlement.playerStats.group).toBe('MF');
  });

  it('시즌이 SETTLE_SEASON까지 완주한다(마지막 step 12까지 결정이 모두 닫힌다)', () => {
    const { beforeSettlement } = runMfFixture();
    expect(beforeSettlement.matchesPlayed).toBeGreaterThan(20);
  });

  it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runMfFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
  });
});
