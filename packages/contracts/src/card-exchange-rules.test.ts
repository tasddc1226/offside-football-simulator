import { describe, expect, it } from 'vitest';
import {
  EXCHANGE_POOL,
  autoFill,
  canFinishAll,
  exchangeById,
  exchangeChecks,
  exchangeDay,
  exchangeMet,
  exchangesAt,
  type ExchangeCard,
} from './card-exchange-rules.js';

let n = 0;
const card = (over: Partial<ExchangeCard> & { cardValue?: number } = {}) => ({
  careerId: `c${++n}`,
  pos: 'MF' as const,
  nation: '대한민국',
  peak: 75,
  legendScore: 300,
  season: 1,
  foot: '오른발',
  cardValue: 100,
  ...over,
});

describe('카드 과제 주기 (T-11-374)', () => {
  it('매일 0시(KST)에 날이 바뀐다', () => {
    // 23:59 KST = 14:59 UTC
    expect(exchangeDay('2026-10-25T14:59:00.000Z').key).toBe('2026-10-25');
    expect(exchangeDay('2026-10-25T15:00:00.000Z')).toEqual({
      key: '2026-10-26',
      startsAt: '2026-10-25T15:00:00.000Z',
      endsAt: '2026-10-26T15:00:00.000Z',
    });
  });

  it('쉬움 과제는 새로 만들 수 없는 프리시즌 카드를 요구하지 않는다 (T-11-374c)', () => {
    for (const spec of EXCHANGE_POOL.easy) expect(spec.rule.seasons ?? []).not.toContain(0);
    expect(exchangesAt('2026-10-25T03:00:00.000Z')[0]!.key).toBe('quietFarewell');
  });

  it('하루마다 칸별 다음 과제를 연다', () => {
    const a = exchangesAt('2026-10-20T00:00:00.000Z');
    const b = exchangesAt('2026-10-21T00:00:00.000Z');
    expect(a.map((d) => d.tier)).toEqual(['easy', 'normal', 'hard']);
    expect(a[0]!.id).toBe('2026-10-20-easy');
    for (const [t, tier] of (['easy', 'normal', 'hard'] as const).entries()) {
      const pool = EXCHANGE_POOL[tier];
      const i = pool.findIndex((s) => s.key === a[t]!.key);
      expect(b[t]!.key).toBe(pool[(i + 1) % pool.length]!.key);
    }
    expect(exchangeById('2026-10-21T00:00:00.000Z', a[0]!.id)).toBeNull();
    expect(exchangeById('2026-10-20T14:00:00.000Z', a[0]!.id)?.id).toBe(a[0]!.id);
  });

  it('하루 과제는 7장을 넘지 않는다', () => {
    for (const pool of Object.values(EXCHANGE_POOL))
      for (const s of pool) expect(s.rule.count).toBeLessThanOrEqual(7);
  });
});

describe('카드 과제 조건 판정', () => {
  it('조건마다 채워졌는지 따로 보인다', () => {
    const rule = { count: 3, pos: ['GK'] as const, peakMax: 79 };
    const picked = [card({ pos: 'GK' }), card({ pos: 'GK', peak: 82 })];
    expect(exchangeChecks(rule, picked)).toEqual([
      { condition: 'count', met: false },
      { condition: 'pos', met: true },
      { condition: 'peak', met: false },
    ]);
    expect(
      exchangeMet(rule, [...picked.slice(0, 1), card({ pos: 'GK' }), card({ pos: 'GK' })]),
    ).toBe(true);
  });

  it('같은 카드를 두 번 넣으면 맞지 않는다', () => {
    const c = card();
    expect(exchangeMet({ count: 2 }, [c, c])).toBe(false);
  });

  it('포지션 구성 · 평균 OVR · 같은 국적 · 레전드 점수 한 장', () => {
    const rule = {
      count: 3,
      shape: { GK: 1, DF: 2 },
      avgPeakMin: 80,
      sameNation: true,
      legendOne: 600,
    };
    const ok = [
      card({ pos: 'GK', peak: 80, legendScore: 700 }),
      card({ pos: 'DF', peak: 80 }),
      card({ pos: 'DF', peak: 80 }),
    ];
    expect(exchangeMet(rule, ok)).toBe(true);
    expect(
      exchangeMet(rule, [...ok.slice(0, 2), card({ pos: 'DF', peak: 80, nation: '일본' })]),
    ).toBe(false);
    expect(exchangeMet(rule, [...ok.slice(0, 2), card({ pos: 'MF', peak: 80 })])).toBe(false);
    expect(exchangeMet(rule, [card({ pos: 'GK', peak: 80 }), ...ok.slice(1)])).toBe(false);
  });
});

describe('맞는 카드로 채우기', () => {
  it('맞는 카드 중 가치가 낮은 순으로 고른다', () => {
    const cards = [
      card({ pos: 'GK', cardValue: 300 }),
      card({ pos: 'GK', cardValue: 100 }),
      card({ pos: 'FW', cardValue: 1 }),
      card({ pos: 'GK', cardValue: 200 }),
      card({ pos: 'GK', cardValue: 900 }),
    ];
    const got = autoFill({ count: 3, pos: ['GK'] }, cards);
    expect(got?.map((c) => c.cardValue)).toEqual([100, 200, 300]);
  });

  it('평균 OVR이 모자라면 낮은 카드를 더 높은 카드로 바꾼다', () => {
    const cards = [
      card({ peak: 70, cardValue: 1 }),
      card({ peak: 72, cardValue: 2 }),
      card({ peak: 90, cardValue: 50 }),
      card({ peak: 88, cardValue: 40 }),
    ];
    const got = autoFill({ count: 2, avgPeakMin: 80 }, cards)!;
    expect(exchangeMet({ count: 2, avgPeakMin: 80 }, got)).toBe(true);
  });

  it('같은 국적은 가장 많은 국적에서, 못 채우면 null', () => {
    const cards = [
      card({ nation: '일본' }),
      card({ nation: '대한민국' }),
      card({ nation: '대한민국' }),
      card({ nation: '대한민국' }),
    ];
    expect(
      autoFill({ count: 3, sameNation: true }, cards)?.every((c) => c.nation === '대한민국'),
    ).toBe(true);
    expect(autoFill({ count: 5, sameNation: true }, cards)).toBeNull();
  });

  it('포지션 구성과 레전드 점수 조건을 함께 채운다', () => {
    const rule = { count: 3, shape: { MF: 2, FW: 1 }, legendOne: 600 };
    const cards = [
      card({ pos: 'FW', legendScore: 650, cardValue: 500 }),
      card({ pos: 'FW', cardValue: 1 }),
      card({ pos: 'MF', cardValue: 2 }),
      card({ pos: 'MF', cardValue: 3 }),
    ];
    const got = autoFill(rule, cards)!;
    expect(exchangeMet(rule, got)).toBe(true);
    expect(got.filter((c) => c.pos === 'FW')).toHaveLength(1);
  });
});

describe('오늘 과제를 모두 채울 수 있나', () => {
  const defs = (rules: { count: number; pos?: readonly ('GK' | 'DF' | 'MF' | 'FW')[] }[]) =>
    rules.map((rule, i) => ({
      key: `k${i}`,
      rule,
      id: `d-${i}`,
      tier: 'easy' as const,
      startsAt: '',
      endsAt: '',
    }));

  it('과제마다 다른 카드로 채운다', () => {
    const cards = [card({ pos: 'GK' }), card({ pos: 'GK' }), card(), card()];
    const two = defs([{ count: 2, pos: ['GK'] }, { count: 2 }]);
    expect(canFinishAll(two, cards)).toBe(true);
    expect(canFinishAll(defs([{ count: 2, pos: ['GK'] }, { count: 3 }]), cards)).toBe(false);
    expect(canFinishAll([], [])).toBe(true);
  });
});
