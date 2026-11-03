import { describe, expect, it } from 'vitest';
import {
  EXCHANGE_POOL,
  POOL_GROWN,
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
      const len = POOL_GROWN[0]!.before[tier];
      const i = pool.findIndex((s) => s.key === a[t]!.key);
      expect(b[t]!.key).toBe(pool[(i + 1) % len]!.key);
    }
    expect(exchangeById('2026-10-21T00:00:00.000Z', a[0]!.id)).toBeNull();
    expect(exchangeById('2026-10-20T14:00:00.000Z', a[0]!.id)?.id).toBe(a[0]!.id);
  });

  it('과제를 늘리기 전 날은 예전 묶음 길이로 돌고, 늘린 날부터 새 과제가 열린다 (T-11-374d)', () => {
    // 늘리기 전 마지막 날의 과제는 그대로다(배포한 날 연 과제가 하루 중간에 바뀌지 않는다).
    expect(exchangesAt('2026-10-26T03:00:00.000Z').map((d) => d.key)).toEqual([
      'strikers',
      'frontLine',
      'bestEleven',
    ]);
    const [first, second] = POOL_GROWN;
    const before = new Set<string>();
    const after = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const at = (from: string) =>
        exchangesAt(new Date(Date.parse(from) + i * 86_400_000).toISOString());
      for (const d of at('2025-09-01T03:00:00.000Z')) before.add(d.key);
      for (const d of at(`${second!.from}T03:00:00.000Z`)) after.add(d.key);
    }
    // 늘린 날은 새 과제부터 연다.
    expect(exchangesAt(`${first!.from}T03:00:00.000Z`).map((d) => d.key)).toEqual([
      'centerBacks',
      'worldTour',
      'worldSelect',
    ]);
    const all = Object.values(EXCHANGE_POOL).flat();
    expect(before.size).toBe(Object.values(first!.before).reduce((a, n) => a + n, 0));
    expect(after.size).toBe(all.length);
    expect(new Set(all.map((s) => s.key)).size).toBe(all.length);
  });

  it('시즌 2 개막 전 날까지는 예전 회전 · 조건 그대로, 개막일부터 줄인 조건과 새 쉬움 과제 (T-11-545)', () => {
    // 고치기 전 회전(2026-10-27 기준, 묶음 길이 9 · 8 · 6)과 같은 날 · 같은 조건.
    expect(exchangesAt('2026-10-30T03:00:00.000Z').map((d) => [d.key, d.rule.count])).toEqual([
      ['keepers', 2],
      ['nationalCall', 4],
      ['legendGift', 5],
    ]);
    expect(exchangesAt('2026-10-29T03:00:00.000Z').map((d) => d.key)).toEqual([
      'twoFooted',
      'engineRoom',
      'bestEleven',
    ]);
    expect(exchangesAt('2026-10-29T03:00:00.000Z')[2]!.rule.count).toBe(7);
    // 개막일은 새로 더한 쉬움 과제부터, 조건은 줄인 값.
    const open = exchangesAt('2026-10-31T03:00:00.000Z');
    expect(open.map((d) => d.key)).toEqual(['fullBacks', 'nationalCall', 'bestEleven']);
    expect(open.map((d) => d.rule.count)).toEqual([2, 3, 4]);
    // 하루에 내는 카드는 7~9장(시즌 1은 11~14장).
    for (let i = 0; i < 200; i++) {
      const day = exchangesAt(
        new Date(Date.parse('2026-10-31T03:00:00.000Z') + i * 86_400_000).toISOString(),
      );
      const total = day.reduce((a, d) => a + d.rule.count, 0);
      expect(total).toBeGreaterThanOrEqual(7);
      expect(total).toBeLessThanOrEqual(9);
    }
    // 옛 조건은 지금 묶음에 있는 과제만 적는다.
    const keys = new Set(
      Object.values(EXCHANGE_POOL)
        .flat()
        .map((s) => s.key),
    );
    for (const k of Object.keys(POOL_GROWN[1]!.rules ?? {})) expect(keys.has(k)).toBe(true);
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

describe('세부 포지션 · 같은 리그 · 다른 국적 (T-11-374d)', () => {
  it('세부 포지션은 목록 안이어야 하고, 세부 포지션이 없는 카드는 맞지 않는다', () => {
    const rule = { count: 2, dpos: ['CB', 'SW'] as const };
    expect(
      exchangeMet(rule, [card({ pos: 'DF', dpos: 'CB' }), card({ pos: 'DF', dpos: 'SW' })]),
    ).toBe(true);
    expect(
      exchangeMet(rule, [card({ pos: 'DF', dpos: 'CB' }), card({ pos: 'DF', dpos: 'LB' })]),
    ).toBe(false);
    expect(exchangeMet(rule, [card({ pos: 'DF', dpos: 'CB' }), card({ pos: 'DF' })])).toBe(false);
  });

  it('같은 리그는 리그를 아는 카드끼리, 채우기는 가장 많은 리그에서', () => {
    const rule = { count: 2, sameLeague: true };
    expect(exchangeMet(rule, [card({ league: 'eng1' }), card({ league: 'eng1' })])).toBe(true);
    expect(exchangeMet(rule, [card({ league: 'eng1' }), card({ league: 'esp1' })])).toBe(false);
    expect(exchangeMet(rule, [card({ league: null }), card({ league: null })])).toBe(false);
    const got = autoFill(rule, [
      card({ league: 'esp1' }),
      card({ league: 'eng1' }),
      card({ league: 'eng1' }),
      card({ league: null }),
    ]);
    expect(got?.map((c) => c.league)).toEqual(['eng1', 'eng1']);
  });

  it('다른 국적은 국적마다 한 장, 평균을 올릴 때도 국적이 겹치지 않는다', () => {
    const rule = { count: 3, distinctNations: true, avgPeakMin: 80 };
    expect(
      exchangeMet({ count: 2, distinctNations: true }, [
        card({ nation: 'KR' }),
        card({ nation: 'KR' }),
      ]),
    ).toBe(false);
    const got = autoFill(rule, [
      card({ nation: 'KR', peak: 70, cardValue: 1 }),
      card({ nation: 'KR', peak: 70, cardValue: 2 }),
      card({ nation: 'JP', peak: 75, cardValue: 3 }),
      card({ nation: 'KR', peak: 90, cardValue: 9 }),
      card({ nation: 'GB', peak: 85, cardValue: 8 }),
    ])!;
    expect(exchangeMet(rule, got)).toBe(true);
    expect(autoFill({ count: 3, distinctNations: true }, [card(), card(), card()])).toBeNull();
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
