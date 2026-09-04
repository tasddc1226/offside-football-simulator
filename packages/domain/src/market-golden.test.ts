import { describe, expect, it } from 'vitest';
import market01Golden from './__fixtures__/market-01-expired.golden.json';
import market02Golden from './__fixtures__/market-02-interest-starter.golden.json';
import market03Golden from './__fixtures__/market-03-loan-bench.golden.json';
import { runMarket01Expired } from './__fixtures__/market-01-expired.js';
import { runMarket02InterestStarter } from './__fixtures__/market-02-interest-starter.js';
import { runMarket03LoanBench } from './__fixtures__/market-03-loan-bench.js';

/**
 * T-3-002 시장 골든 3종: career-06-settled 결산 뒤 상태를 태그·역할·계약 잔여만 바꿔 합성한 뒤
 * `generateMarket` 출력 전체(`pending`)와 `rngState.draws` 증가량을 고정한다. phase-03 완료 조건
 * "제안 3개 비교"(역할·적합도·출전 약속·경쟁·리그·급여가 서로 다른 제안)를 증명하는 fixture다 —
 * 아래 3개 골든을 합치면 RENEWAL·FREE_AGENT·TRANSFER·LOAN 네 종류가 모두 등장하고, 역할
 * (RESERVE/BENCH/ROTATION/STARTER)·리그 티어(1/2)·급여·적합도·경쟁 요약이 서로 다르다.
 */
describe('market 골든 1: 만료(EXPIRED) — 안전 잔류 + FREE_AGENT', () => {
  it('reason·draws·pending이 golden과 정확히 같다', () => {
    const { reason, state, result } = runMarket01Expired();
    expect(reason).toBe(market01Golden.reason);
    expect(state.rngState.draws).toBe(market01Golden.rngStateDrawsBefore);
    expect(result.rngState.draws).toBe(market01Golden.rngStateDrawsAfter);
    expect(result.pending).toEqual(market01Golden.pending);
  });

  it('같은 fixture를 20회 실행해도 매번 golden과 같다', () => {
    for (let i = 0; i < 20; i++) {
      expect(runMarket01Expired().result.pending).toEqual(market01Golden.pending);
    }
  });
});

describe('market 골든 2: 관심·STARTER(이적_희망+에이전트_계약) — 제안 4개, TRANSFER 위주', () => {
  it('reason·draws·pending이 golden과 정확히 같다', () => {
    const { reason, state, result } = runMarket02InterestStarter();
    expect(reason).toBe(market02Golden.reason);
    expect(state.rngState.draws).toBe(market02Golden.rngStateDrawsBefore);
    expect(result.rngState.draws).toBe(market02Golden.rngStateDrawsAfter);
    expect(result.pending).toEqual(market02Golden.pending);
    expect(result.pending.offers).toHaveLength(5);
    const drawnKinds = result.pending.offers.slice(1).map((offer) => offer.kind);
    expect(drawnKinds.filter((kind) => kind === 'TRANSFER').length).toBeGreaterThan(
      drawnKinds.filter((kind) => kind === 'LOAN').length,
    );
  });
});

describe('market 골든 3: 관심·BENCH(이적_희망) — 제안 3개, LOAN 위주·바이아웃 포함', () => {
  it('reason·draws·pending이 golden과 정확히 같다', () => {
    const { reason, state, result } = runMarket03LoanBench();
    expect(reason).toBe(market03Golden.reason);
    expect(state.rngState.draws).toBe(market03Golden.rngStateDrawsBefore);
    expect(result.rngState.draws).toBe(market03Golden.rngStateDrawsAfter);
    expect(result.pending).toEqual(market03Golden.pending);
    expect(result.pending.offers).toHaveLength(4);
    const loanOffers = result.pending.offers.filter((offer) => offer.kind === 'LOAN');
    expect(loanOffers.length).toBeGreaterThan(0);
    expect(loanOffers.some((offer) => offer.loan?.buyOptionMinor !== null)).toBe(true);
  });
});
