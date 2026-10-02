import { describe, expect, it } from 'vitest';
import type { RetiredNumberResult } from '@offside/contracts';
import { seasonValue } from '@offside/contracts/market-value';
import type { CareerRecord, HofEntry } from '@offside/game/types';
import {
  EVENT_ICON,
  earnedTitles,
  luckNote,
  luckText,
  pct,
  potVerdict,
  rnClubStats,
  rnSlotOf,
  valuePoints,
  yearsOf,
} from './legendReport.js';
import type { LegendView } from './state.js';

const rec = (over: Partial<CareerRecord> = {}): CareerRecord => ({
  year: 2030,
  age: 25,
  club: 'FC',
  league: 'K리그1',
  apps: 30,
  goals: 10,
  assists: 5,
  cs: 0,
  rating: 7,
  rank: 1,
  ovr: 70,
  honors: [],
  ...over,
});
const granted = (over: Partial<Extract<RetiredNumberResult, { kind: 'granted' }>> = {}) =>
  ({ kind: 'granted', seq: 1, clubId: 'k1-0', club: '서울', number: 10, ...over }) as Extract<
    RetiredNumberResult,
    { kind: 'granted' }
  >;

describe('yearsOf', () => {
  it('첫 해만 네 자리, 나머지는 두 자리', () => {
    expect(yearsOf([2036, 2037, 2039])).toBe('2036 · 37 · 39');
  });
  it('한 해면 그대로, 빈 목록이면 빈 문자열, 2100년대는 두 자리 0 채움', () => {
    expect(yearsOf([2036])).toBe('2036');
    expect(yearsOf([])).toBe('');
    expect(yearsOf([2098, 2101])).toBe('2098 · 01');
  });
});

describe('EVENT_ICON', () => {
  it('여정 종류마다 아이콘이 있다', () => {
    expect(Object.keys(EVENT_ICON).sort()).toEqual(['mile', 'story', 'trophy']);
  });
});

describe('potVerdict', () => {
  it('잠재력 정보가 없으면 빈 문자열', () => {
    expect(potVerdict(undefined)).toBe('');
  });
  it('실제 잠재력이 평가보다 높으면 큰 재능, 낮으면 못 폈다, 같으면 정확', () => {
    const pot = (gap: number) => ({ real: 'A', scout: 'B', gap, ach: 0 });
    expect(potVerdict(pot(3))).toBe('스카우트 평가(B)보다 큰 재능이었어요.');
    expect(potVerdict(pot(-1))).toBe('스카우트 평가(B)만큼은 피지 못했어요.');
    expect(potVerdict(pot(0))).toBe('스카우트의 눈이 정확했어요(평가 B).');
  });
});

describe('rnSlotOf', () => {
  const own = {} as LegendView['own'];
  it('결번 결과가 없거나 심사 중이면 null', () => {
    expect(rnSlotOf(null, own)).toBeNull();
    expect(rnSlotOf({ kind: 'pending' }, own)).toBeNull();
  });
  it('이름을 숨긴 결번은 내 선수에게만 보인다', () => {
    const anon: RetiredNumberResult = {
      kind: 'anonymous',
      clubId: 'k1-0',
      club: '서울',
      number: 10,
    };
    expect(rnSlotOf(anon, null)).toBeNull();
    expect(rnSlotOf(anon, own)).toBe(anon);
  });
  it('받은 결번·이미 찬 자리는 누구에게나 보인다', () => {
    const g = granted();
    expect(rnSlotOf(g, null)).toBe(g);
    const taken: RetiredNumberResult = { ...g, kind: 'taken', holder: null };
    expect(rnSlotOf(taken, null)).toBe(taken);
  });
});

describe('rnClubStats', () => {
  const d = (career: CareerRecord[]) => ({ career }) as unknown as LegendView['d'];
  it('상세가 없거나 그 구단 기록이 없으면 null', () => {
    expect(rnClubStats(granted(), null)).toBeNull();
    expect(rnClubStats(granted(), d([rec({ clubId: 'k1-5' })]))).toBeNull();
  });
  it('구단 id 가 같은 시즌만 모아 기간·합계를 낸다', () => {
    const stats = rnClubStats(
      granted(),
      d([
        rec({ year: 2028, clubId: 'k1-0', apps: 10, goals: 1, assists: 2 }),
        rec({ year: 2029, clubId: 'k1-3', apps: 99, goals: 99, assists: 99 }),
        rec({ year: 2031, clubId: 'k1-0', apps: 20, goals: 4, assists: 3 }),
      ]),
    );
    expect(stats).toEqual({ from: 2028, to: 2031, seasons: 2, apps: 30, goals: 5, assists: 5 });
  });
  it('구단 id 가 없는 옛 기록은 이름으로 찾는다', () => {
    const stats = rnClubStats(
      granted({ club: '서울' }),
      d([rec({ club: '서울' }), rec({ club: '부산' })]),
    );
    expect(stats).toMatchObject({ seasons: 1, apps: 30 });
  });
});

describe('플레이 성향 문구', () => {
  it('pct — 분모가 0 이면 0, 아니면 반올림', () => {
    expect(pct(3, 0)).toBe(0);
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(5, 5)).toBe(100);
  });
  it('luckText — 부호 표기, 0 은 ±0', () => {
    expect(luckText(4)).toBe('+4');
    expect(luckText(-4)).toBe('-4');
    expect(luckText(0)).toBe('±0');
  });
  it('luckNote — 기대보다 더/덜/딱', () => {
    expect(luckNote(2)).toBe('기대보다 2번 더 성공');
    expect(luckNote(-3)).toBe('기대보다 3번 덜 성공');
    expect(luckNote(0)).toBe('딱 기대만큼 성공');
  });
});

describe('valuePoints', () => {
  it('프로 시즌만 몸값이 있고, x 는 0~1 로 고르게 펼친다', () => {
    const rows = [
      rec({ league: '고교 리그', age: 18 }),
      rec({ age: 24 }),
      rec({ age: 25, ovr: 75 }),
    ];
    const peak = seasonValue(rows[2]!);
    const pts = valuePoints(rows, peak);
    expect(pts.map((p) => p.x)).toEqual([0, 0.5, 1]);
    expect(pts[0]).toMatchObject({ v: 0, y: 100 });
    expect(pts[2]).toMatchObject({ v: peak, y: 20 });
    expect(pts[1]!.y).toBeGreaterThan(20);
    expect(pts[1]!.y).toBeLessThan(100);
  });
  it('시즌이 하나면 가운데(x 0.5)에 놓는다', () => {
    expect(valuePoints([rec()], 1)[0]!.x).toBe(0.5);
  });
  it('최고 몸값이 0 이면 1 로 나눠 NaN 을 막는다', () => {
    const pts = valuePoints([rec({ league: '고교 리그' })], 0);
    expect(pts[0]!.y).toBe(100);
  });
  it('기록이 없으면 빈 목록', () => {
    expect(valuePoints([], 100)).toEqual([]);
  });
});

describe('earnedTitles', () => {
  const entry = (titles: { id: string; year: number }[] | undefined) =>
    ({ detail: titles ? { titles } : undefined }) as unknown as HofEntry;
  it('희귀한 것부터, 같으면 최근 것부터', () => {
    const list = earnedTitles(
      entry([
        { id: 'goals100', year: 2030 },
        { id: 'goals300', year: 2031 },
        { id: 'fame100', year: 2033 },
        { id: 'ovr90', year: 2035 },
      ]),
    );
    expect(list.map((t) => [t.d.id, t.year])).toEqual([
      ['ovr90', 2035],
      ['goals300', 2031],
      ['fame100', 2033],
      ['goals100', 2030],
    ]);
  });
  it('모르는 칭호 id 는 뺀다', () => {
    expect(earnedTitles(entry([{ id: 'nope', year: 2030 }]))).toEqual([]);
  });
  it('상세나 칭호가 없으면 빈 목록', () => {
    expect(earnedTitles(entry(undefined))).toEqual([]);
    expect(earnedTitles({} as HofEntry)).toEqual([]);
  });
});
