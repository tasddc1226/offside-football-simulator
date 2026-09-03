import { describe, expect, it } from 'vitest';
import golden from './__fixtures__/career-04-gk.golden.json';
import { runGkFixture } from './__fixtures__/career-04-gk.js';
import { verifySnapshot } from './simulate.js';

// T-2-003 D-35 golden 절차 3: GK 아키타입 fixture. career-02-season(FW)과 달리 saves·cleanSheet가
// 실제로 쌓이고, 평점 분포가 FW와 같은 40~100 스케일임을 고정한다(balance-targets "포지션별 기여").
describe('career-04-gk fixture 결정론(GK 아키타입)', () => {
  it('golden 값과 정확히 일치한다(revision·stateHash·rngStateDraws·age·seasonHistory)', () => {
    const { snapshot } = runGkFixture();
    expect(snapshot.revision).toBe(golden.revision);
    expect(snapshot.stateHash).toBe(golden.stateHash);
    expect(snapshot.state.rngState.draws).toBe(golden.rngStateDraws);
    expect(snapshot.state.age).toBe(golden.age);
    expect(snapshot.state.season).toBeNull();
    expect(snapshot.state.seasonHistory).toEqual(golden.seasonHistory);
    expect(verifySnapshot(snapshot)).toEqual({ ok: true });
  });

  it('SETTLE_SEASON 직전 GK 통계(saves·cleanSheet·평균 평점·대회 기록)가 golden과 같다', () => {
    const { beforeSettlement } = runGkFixture();
    expect(beforeSettlement).toEqual(golden.beforeSettlement);
  });

  it('클린시트·선방이 실제로 집계된다(0이면 이 fixture의 의미가 없다)', () => {
    const { beforeSettlement } = runGkFixture();
    const totals = beforeSettlement.playerStats.totals as { saves: number; cleanSheet: number };
    expect(totals.saves).toBeGreaterThan(0);
    expect(totals.cleanSheet).toBeGreaterThan(0);
    expect(beforeSettlement.playerStats.group).toBe('GK');
  });

  // career-02-season golden(FW, averageRatingTenths ~65)과 비교해 GK 평점도 40~100 정수 스케일
  // 안에서 비슷한 대역임을 고정한다(포지션군별 절대 가중치가 달라도 표시 스케일은 같아야 한다).
  it('GK 평균 평점이 FW와 같은 40~100 정수 스케일 안에 있다', () => {
    const { beforeSettlement } = runGkFixture();
    expect(beforeSettlement.averageRatingTenths).not.toBeNull();
    expect(beforeSettlement.averageRatingTenths!).toBeGreaterThanOrEqual(40);
    expect(beforeSettlement.averageRatingTenths!).toBeLessThanOrEqual(100);
    expect(Number.isInteger(beforeSettlement.averageRatingTenths)).toBe(true);
  });

  it('같은 fixture를 100회 실행해도 매번 golden hash와 같다', { timeout: 15000 }, () => {
    for (let i = 0; i < 100; i++) {
      const { snapshot } = runGkFixture();
      expect(snapshot.stateHash).toBe(golden.stateHash);
    }
  });
});
