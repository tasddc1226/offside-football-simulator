import { describe, expect, it } from 'vitest';
import {
  cardFootNote,
  cardTier,
  fmtValue,
  iGa,
  playerName,
  withEulReul,
  withRo,
} from './format.js';
import { en } from './i18n/en/index.js';
import { ja } from './i18n/ja/index.js';
import { setLocale } from './i18n/core.js';
import { priceAtPct, priceDiff, releaseLock } from './market.js';
import { chartModel, marketIndex, ratioPct } from './marketChart.js';

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
    expect(cardTier(1800, 78)).toBe('icon');
    expect(cardTier(1100, 71)).toBe('legend');
    expect(cardTier(1099, 85)).toBe('elite');
    expect(cardTier(999, 84)).toBe('gold');
    expect(cardTier(null, 75)).toBe('gold');
    expect(cardTier(null, 74)).toBe('silver');
    expect(cardTier(0, 65)).toBe('silver');
    expect(cardTier(0, 64)).toBe('bronze');
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

describe('시세 차트 (T-11-080f)', () => {
  const p = (day: string, avg: number, min = avg, max = avg) => ({
    day,
    trades: 2,
    volume: 1,
    avg,
    min,
    max,
  });

  it('시장 지수는 마지막 거래일 평균과 그 전 거래일과의 차이', () => {
    expect(marketIndex([])).toBeNull();
    expect(ratioPct(986)).toBe('98.6%');
    expect(marketIndex([p('2026-10-04', 1000), p('2026-10-05', 986)])).toMatchObject({
      pct: '98.6%',
      tone: 'down',
      change: '▼ 1.4%p',
      trades: 4,
    });
    expect(marketIndex([p('2026-10-05', 1000)])?.change).toBe('변동 없음');
  });

  it('기간 첫날~오늘을 가로축으로, 값과 기준가를 담게 세로축을 잡는다', () => {
    expect(chartModel([], [], 'week', '2026-10-05')).toBeNull();
    const m = chartModel(
      [p('2026-09-29', 1000), p('2026-10-05', 1100, 900, 1200)],
      [
        { price: 1, ratio: 700, soldAt: '2026-10-04T16:00:00.000Z' },
        { price: 1, ratio: 1000, soldAt: '2026-09-01T00:00:00.000Z' },
      ],
      'week',
      '2026-10-05',
    )!;
    expect(m.days.map((d) => d.x)).toEqual([0, 100]);
    // 기간 밖 거래는 빼고, UTC 16시 거래는 KST로 다음 날(10/5)이다.
    expect(m.dots.map((d) => [d.x, d.t.ratio])).toEqual([[100, 700]]);
    expect([m.top, m.bottom, m.from, m.to, m.tone]).toEqual(['125%', '65%', '9/29', '10/5', 'up']);
    expect(m.base).toBeGreaterThan(m.days[1]!.y);
  });
});

describe('fmtValue 언어 (T-11-119)', () => {
  it('영어에서는 억·천만 대신 원화 약식으로 쓴다', () => {
    expect(fmtValue(1_234_000)).toBe('123억 4천만');
    setLocale('en');
    try {
      expect(fmtValue(1_234_000)).toBe('₩12.34B');
    } finally {
      setLocale('ko');
    }
  });
});

describe('playerName 언어 (T-11-144)', () => {
  it('다른 유저 선수 이름을 게임 안 이름과 같은 표로 옮기고, 비공개면 익명 표기', () => {
    expect(playerName('김서준', 'FW', 9)).toBe('김서준');
    expect(playerName(null, 'FW', 9)).toBe('익명의 공격수 No.9');
    try {
      setLocale('ja', ja);
      expect(playerName('김서준', 'FW', 9)).toBe('キム・ソジュン');
      expect(playerName('Kane', 'FW', 9)).toBe('Kane');
      expect(playerName(null, 'GK', null)).toBe('匿名のゴールキーパー');
      setLocale('en', en);
      expect(playerName('김서준', 'FW', 9)).toBe('Kim Seo-jun');
      expect(playerName(undefined, 'MF', 7)).toBe('Anonymous midfielder No.7');
    } finally {
      setLocale('ko');
    }
  });
});
