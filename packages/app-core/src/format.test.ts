import { describe, expect, it } from 'vitest';
import { cardFootNote, cardTier, iGa, withEulReul, withRo } from './format.js';
import { priceAtPct, priceDiff, releaseLock } from './market.js';

describe('withRo', () => {
  it('받침에 맞춰 로/으로를 붙인다', () => {
    expect(withRo('정현우')).toBe('정현우로');
    expect(withRo('신재형')).toBe('신재형으로');
    expect(withRo('김철')).toBe('김철로');
    expect(withRo('Kane')).toBe('Kane(으)로');
  });
  it('숫자로 끝나면 한국어로 읽은 받침을 따른다(후보 3으로, v2로, v7로)', () => {
    expect(withRo('후보 3')).toBe('후보 3으로');
    expect(withRo('후보 2')).toBe('후보 2로');
    expect(withRo('v7')).toBe('v7로');
    expect(withRo('v10')).toBe('v10으로');
    expect(withEulReul('v2')).toBe('v2를');
    expect(withEulReul('v3')).toBe('v3을');
    expect(iGa('v1')).toBe('이');
  });
});

describe('cardFootNote (T-11-080)', () => {
  it('능력치 안내가 먼저, 그다음 기준가, 둘 다 없으면 null', () => {
    expect(cardFootNote({ attrs: null, cardValue: 543_000 })).toBe('능력치 기록 없음');
    expect(cardFootNote({ attrs: {}, attrsEstimated: true, cardValue: 543_000 })).toBe(
      '추정 능력치',
    );
    expect(cardFootNote({ attrs: {}, cardValue: 543_000 })).toBe('기준가 54억 3천만');
    expect(cardFootNote({ attrs: {}, cardValue: null })).toBeNull();
  });
});

describe('이적시장 표시 (T-11-080d)', () => {
  const rules = {
    releaseRate: 1,
    feeRate: 0.05,
    priceMin: 0.5,
    priceMax: 3,
    listLimit: 20,
    dailyBuys: 10,
  };
  it('카드 등급은 레전드 점수 → 최고 OVR 순으로 정한다', () => {
    expect(cardTier(1000, 60)).toBe('legend');
    expect(cardTier(999, 80)).toBe('gold');
    expect(cardTier(null, 79)).toBe('silver');
  });
  it('판매가 옆 표시는 기준가와의 차이(%)', () => {
    expect(priceDiff(100_000, 100_000)).toEqual({ text: '기준가', tone: 'same' });
    expect(priceDiff(120_000, 100_000)).toEqual({ text: '기준가 +20%', tone: 'up' });
    expect(priceDiff(90_000, 100_000)).toEqual({ text: '기준가 −10%', tone: 'down' });
  });
  it('슬라이더 %는 100만 원 단위로 맞추고 범위 안에 둔다', () => {
    expect(priceAtPct(80_000, 125, rules)).toBe(100_000);
    expect(priceAtPct(83_333, 100, rules)).toBe(83_300);
    expect(priceAtPct(80_000, 999, rules)).toBe(240_000);
  });
  it('방출은 직접 키운 선수 중 판매 중도 선발도 아닌 선수만', () => {
    const p = { careerId: 'a', raised: true, listing: null } as never;
    expect(releaseLock(p, new Set())).toBeNull();
    expect(releaseLock({ ...(p as object), raised: false } as never, new Set())).toContain(
      '영입한 선수',
    );
    expect(
      releaseLock({ ...(p as object), listing: { id: 'x', price: 1 } } as never, new Set()),
    ).toContain('판매 중');
    expect(releaseLock(p, new Set(['a']))).toContain('선발');
  });
});
