import { describe, expect, it } from 'vitest';
import {
  cardBody,
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
import {
  cardMeta,
  cardStyle,
  lockToggleable,
  priceAtPct,
  priceDiff,
  releaseLock,
  sellable,
  sellCandidates,
  sellNote,
  marketDetailFilters,
  findClubs,
  findLeagueOf,
  findLeagues,
  findNations,
  marketFindChips,
  marketFiltered,
  marketSeasonChoices,
  marketSubReset,
  marketTypeFilters,
  pickMarketFilter,
} from './market.js';
import { chartModel, marketIndex, ratioPct } from './marketChart.js';
import { MARKET_TYPES } from '@offside/contracts/market-value';
import { TYPES } from '@offside/game/data';

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

describe('cardBody (T-11-211)', () => {
  it('키·몸무게 뒤에 주발, 체격이 없으면 주발만, 둘 다 없으면 null', () => {
    expect(cardBody({ height: 183, weight: 76, foot: '왼발' })).toBe('183cm · 76kg · 왼발');
    expect(cardBody({ foot: '양발' })).toBe('양발');
    expect(cardBody({ height: 183, weight: 76 })).toBe('183cm · 76kg');
    expect(cardBody({})).toBeNull();
  });
});

describe('이적시장 줄 유형 (T-11-356)', () => {
  it('유형은 따로 돌려주고 아래 한 줄에는 레전드 점수·이적 횟수만', () => {
    expect(cardStyle({ pos: 'FW', type: 'speed' })).toBe('스피드스터');
    const c = { legendScore: 1234, transfers: 2, peak: 86, season: 1 };
    expect(cardMeta(c)).toBe('레전드 1,234 · 이적 2회');
    expect(cardMeta(c, 1)).toBe('레전드 1,234 · 이적 2회');
    // T-11-425 지난 시즌 카드는 출신 시즌과 급여(최고 OVR 86 → 6)를 앞에 붙인다.
    expect(cardMeta(c, 2)).toBe('시즌 1 · 급여 6 · 레전드 1,234 · 이적 2회');
  });
  it('유형이 없거나 모르는 id면 null', () => {
    expect(cardStyle({ pos: 'FW', type: null })).toBeNull();
    expect(cardStyle({ pos: 'FW' })).toBeNull();
    expect(cardStyle({ pos: 'GK', type: 'speed' })).toBeNull();
  });
});

describe('이적시장 표시 (T-11-080d)', () => {
  const rules = {
    releaseRate: 1,
    feeRate: 0.05,
    priceMin: 0.5,
    priceMax: 3,
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
  it('T-11-474 팔기 탭은 지금 시즌 선발을 보이지 않는다', () => {
    const players = [{ careerId: 'a' }, { careerId: 'b' }, { careerId: 'c' }] as never[];
    expect(
      sellCandidates(players, new Set(['b'])).map((p) => (p as { careerId: string }).careerId),
    ).toEqual(['a', 'c']);
    expect(sellCandidates(players, new Set())).toHaveLength(3);
  });
  it('T-11-188 잠긴 선수는 내놓거나 방출할 수 없고, 판매 중인 선수는 잠글 수 없다', () => {
    const p = { careerId: 'a', raised: true, listing: null, cardValue: 80_000 } as never;
    const locked = { ...(p as object), locked: true } as never;
    const listed = { ...(p as object), listing: { id: 'x', price: 1 } } as never;
    expect(sellable(p)).toBe(true);
    expect(sellable(locked)).toBe(false);
    expect(sellNote(locked)).toBe('잠김');
    expect(sellNote(p)).toBe('');
    expect(releaseLock(locked, new Set())).toBe('잠긴 선수예요');
    expect(lockToggleable(p)).toBe(true);
    expect(lockToggleable(locked)).toBe(true);
    expect(lockToggleable(listed)).toBe(false);
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
    // T-11-474 면 · 거래량 막대 · 마지막 점 · 기간 변동
    expect(m.area.endsWith('L100,100L0,100Z')).toBe(true);
    expect(m.bars.map((b) => [b.x, b.h])).toEqual([
      [0, 100],
      [100, 100],
    ]);
    expect(m.last).toMatchObject({ x: 100, pct: '110%' });
    expect(m.change).toBe('▲ 10%p');
  });

  it('T-11-474 시장 지수는 오늘 거래 수와 스파크 면 · 막대를 함께 준다', () => {
    const today = new Date().toISOString().slice(0, 10);
    const i = marketIndex([p('2026-10-01', 1000), { ...p(today, 1050), trades: 5 }])!;
    expect(i.lastTrades).toBe(5);
    expect(i.spark.bars.map((b) => b.h)).toEqual([40, 100]);
    expect(i.spark.area).not.toBe('');
    expect(i.spark.last?.x).toBe(100);
  });
});

describe('이적시장 세부 필터 (T-11-474)', () => {
  it('세부 포지션 · 유형은 포지션군을 고른 뒤에만, 포지션군을 바꾸면 풀린다', () => {
    expect(marketDetailFilters(undefined)).toEqual([]);
    expect(marketDetailFilters('GK')).toEqual([]);
    expect(marketDetailFilters('FW')).toContain('LW');
    expect(marketTypeFilters('MF').map(([id]) => id)).toEqual(['maker', 'b2b', 'winger']);
    expect(marketTypeFilters('FW')[1]).toEqual(['speed', '스피드스터']);
    const f = pickMarketFilter({ pos: 'FW' }, { dpos: 'LW' });
    expect(pickMarketFilter(f, { type: 'speed' })).toEqual({
      pos: 'FW',
      dpos: 'LW',
      type: 'speed',
    });
    expect(pickMarketFilter(f, { pos: 'MF' })).toEqual({ pos: 'MF' });
    expect(pickMarketFilter(f, { pos: 'FW' })).toEqual(f);
    expect(marketFiltered({})).toBe(false);
  });

  it('T-11-500 국적 · 팀은 포지션을 바꿔도 남고, 리그와 클럽은 둘 중 하나만', () => {
    const f = pickMarketFilter({ pos: 'FW', dpos: 'LW' }, { nation: 'BR' });
    expect(pickMarketFilter(f, { pos: 'MF' })).toEqual({ pos: 'MF', nation: 'BR' });
    expect(marketSubReset(f)).toEqual({ pos: 'FW', nation: 'BR' });
    const club = pickMarketFilter(pickMarketFilter(f, { league: 'pl' }), { club: 'pl-0' });
    expect(club).toMatchObject({ club: 'pl-0', league: undefined });
    expect(pickMarketFilter(club, { league: 'll' })).toMatchObject({
      league: 'll',
      club: undefined,
    });
    expect(marketFiltered({ nation: 'BR' })).toBe(true);
    // T-11-596 카드 시즌도 포지션을 바꿔도 남는다(프리시즌 0도 고른 것으로 센다).
    expect(pickMarketFilter({ pos: 'FW', cardSeason: 1 }, { pos: 'MF' })).toEqual({
      pos: 'MF',
      cardSeason: 1,
    });
    expect(marketFiltered({ cardSeason: 0 })).toBe(true);
    expect(marketSeasonChoices(2)).toEqual([0, 1, 2]);
    expect(marketSeasonChoices(null)).toEqual([]);
    expect(marketFindChips({ nation: 'BR', club: 'pl-0' })).toEqual([
      { key: 'nation', name: '브라질' },
      { key: 'club', name: '맨체스터 스카이블루' },
    ]);
  });

  it('T-11-500 고를 거리를 이름으로 좁히고, 모르는 국적 · 아마추어 클럽은 뺀다', () => {
    const facets = {
      nations: [
        { id: 'KR', n: 9 },
        { id: 'BR', n: 3 },
        { id: 'ZZ', n: 1 },
      ],
      leagues: [
        { id: 'pl', n: 5 },
        { id: 'll', n: 2 },
        { id: 'hs', n: 1 },
      ],
      clubs: [
        { id: 'pl-0', n: 3 },
        { id: 'pl-4', n: 2 },
        { id: 'll-1', n: 2 },
        { id: 'hs-0', n: 1 },
        { id: 'pl-99', n: 1 },
      ],
    };
    expect(findNations(facets, '').map((x) => x.id)).toEqual(['KR', 'BR']);
    expect(findNations(facets, '브라').map((x) => x.id)).toEqual(['BR']);
    expect(findLeagues(facets, '').map((x) => x.id)).toEqual(['pl', 'll']);
    expect(findClubs(facets, 'pl', '').map((x) => x.id)).toEqual(['pl-0', 'pl-4']);
    // 검색어가 있으면 리그와 상관없이 모든 클럽에서 찾는다(띄어쓰기 무시).
    expect(findClubs(facets, 'll', '맨체스터스카이').map((x) => x.id)).toEqual(['pl-0']);
    expect(findLeagueOf({ club: 'll-1' }, facets)).toBe('ll');
    expect(findLeagueOf({}, facets)).toBe('pl');
  });

  it('필터 유형 id는 게임 유형 목록과 같다', () => {
    for (const pos of ['FW', 'MF', 'DF', 'GK'] as const)
      expect(MARKET_TYPES[pos]).toEqual(TYPES[pos].map((t) => t.id));
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
