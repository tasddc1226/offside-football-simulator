import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-09-fw.golden.json';
import { runFwFixture } from './__fixtures__/career-09-fw.js';
import { verifySnapshot } from './simulate.js';

// T-2-011 1번: FW 포지션군(ST 아키타입 `st-poacher`) fixture. career-01·career-02-season·
// career-03-underdog은 W(윙어) 아키타입만 다뤘으므로, 이 fixture는 ST(스트라이커)로 FW군
// 통계(goals·xgCenti·offsides)를 별도로 고정한다. FAST 모드로 CREATE_CAREER부터 SETTLE_SEASON까지
// 실제 룰셋 1.0.0·팩 0.1.0으로 완주한다.
describe('career-09-fw fixture 결정론(FW 포지션군, ST 아키타입)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runFwFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 FW 통계(득점·슈팅·평균 평점·대회 기록)가 golden과 같다', () => {
    const { beforeSettlement } = runFwFixture();
    expect({
      matchesPlayed: beforeSettlement.matchesPlayed,
      playerStats: beforeSettlement.playerStats,
      averageRatingTenths: beforeSettlement.averageRatingTenths,
      competitions: beforeSettlement.competitions,
    }).toEqual(golden.beforeSettlement);
  });

  it('FW 전용 통계가 실제로 집계된다(0이면 이 fixture의 의미가 없다)', () => {
    const { beforeSettlement } = runFwFixture();
    const totals = beforeSettlement.playerStats.totals as { goals: number; shots: number; xgCenti: number };
    expect(totals.goals).toBeGreaterThan(0);
    expect(totals.shots).toBeGreaterThan(0);
    expect(totals.xgCenti).toBeGreaterThan(0);
    expect(beforeSettlement.playerStats.group).toBe('FW');
  });

  it('시즌이 SETTLE_SEASON까지 완주한다(마지막 step 12까지 결정이 모두 닫힌다)', () => {
    const { beforeSettlement } = runFwFixture();
    expect(beforeSettlement.matchesPlayed).toBeGreaterThan(15);
  });

  it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runFwFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
  });
});
