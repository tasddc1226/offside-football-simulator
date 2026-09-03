import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-07-df.golden.json';
import { runDfFixture } from './__fixtures__/career-07-df.js';
import { verifySnapshot } from './simulate.js';

// T-2-011 1번: DF 포지션군(CB 아키타입 `cb-stopper`) fixture. FAST 모드로 CREATE_CAREER부터
// SETTLE_SEASON까지 실제 룰셋 1.0.0·팩 0.1.0으로 완주한다.
describe('career-07-df fixture 결정론(DF 포지션군, CB 아키타입)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runDfFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 DF 통계(태클·인터셉트·평균 평점·대회 기록)가 golden과 같다', () => {
    const { beforeSettlement } = runDfFixture();
    expect({
      matchesPlayed: beforeSettlement.matchesPlayed,
      playerStats: beforeSettlement.playerStats,
      averageRatingTenths: beforeSettlement.averageRatingTenths,
      competitions: beforeSettlement.competitions,
    }).toEqual(golden.beforeSettlement);
  });

  it('DF 전용 통계가 실제로 집계된다(0이면 이 fixture의 의미가 없다)', () => {
    const { beforeSettlement } = runDfFixture();
    const totals = beforeSettlement.playerStats.totals as { tackles: number; interceptions: number; aerialsWon: number };
    expect(totals.tackles).toBeGreaterThan(0);
    expect(totals.interceptions).toBeGreaterThan(0);
    expect(totals.aerialsWon).toBeGreaterThan(0);
    expect(beforeSettlement.playerStats.group).toBe('DF');
  });

  it('시즌이 SETTLE_SEASON까지 완주한다(마지막 step 12까지 결정이 모두 닫힌다)', () => {
    const { beforeSettlement } = runDfFixture();
    expect(beforeSettlement.matchesPlayed).toBeGreaterThan(20);
  });

  it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runDfFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
  });
});
