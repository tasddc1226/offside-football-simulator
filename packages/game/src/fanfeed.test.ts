import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { fanLineCount, pickFanLines } from './fanfeed.js';
import type { CareerRecord } from './types.js';

function makeRec(over: Partial<CareerRecord>): CareerRecord {
  return {
    year: 2026,
    age: 18,
    club: 'test',
    league: 'K리그1',
    apps: 20,
    goals: 5,
    assists: 3,
    cs: 0,
    rating: 6.9,
    rank: 4,
    ovr: 60,
    honors: [],
    pro: true,
    ...over,
  };
}
const ctx = {
  gotTrophy: false,
  injuredThisSeason: false,
  transferredThisSeason: false,
  hasMilestone: false,
};

describe('pickFanLines', () => {
  it('T-11-236 인기만큼 1~5줄을 반환하고, 같은 입력에는 같은 결과를 낸다(결정적)', () => {
    setActiveRng(createRng(1));
    const s = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      1,
    );
    const rec = makeRec({});
    const a = pickFanLines(s, rec, ctx);
    const b = pickFanLines(s, rec, ctx);
    // 새 선수는 인기 3이라 동네·학교 응원 한 줄뿐이다.
    expect(a).toHaveLength(1);
    expect(a).toEqual(b);
    for (const [fame, n] of [
      [0, 1],
      [10, 2],
      [20, 3],
      [40, 4],
      [70, 5],
      [500, 5],
    ] as const) {
      expect(fanLineCount(fame)).toBe(n);
      s.fame = fame;
      expect(pickFanLines(s, makeRec({ goals: 20, rating: 7.8, rank: 1 }), ctx)).toHaveLength(n);
    }
  });

  it('T-11-236 인기 구간마다 다른 목소리가 맨 앞에 온다', async () => {
    const { FAN_LINES } = await import('./fanfeed-data.js');
    setActiveRng(createRng(3));
    const s = newGame(
      { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
      3,
    );
    const first = (fame: number) => {
      s.fame = fame;
      return pickFanLines(s, makeRec({}), ctx)[0]!;
    };
    expect(FAN_LINES.fans_local).toContain(first(5));
    expect(FAN_LINES.fans_growing).toContain(first(30));
    expect(FAN_LINES.fans_star).toContain(first(90));
    // 50~70은 따로 목소리 없이 성적·응원 반응만.
    const mid = first(50);
    expect([
      ...FAN_LINES.fans_local,
      ...FAN_LINES.fans_growing,
      ...FAN_LINES.fans_star,
    ]).not.toContain(mid);
  });

  it('메인 게임 RNG 시드 상태를 전혀 소비하지 않는다(결정성 보존)', () => {
    setActiveRng(createRng(42));
    const s = newGame(
      { name: 'a', number: 1, pos: 'MF', foot: '오른발', type: 'maker', trait: 'late' },
      42,
    );
    const before = getActiveRng().getState();
    pickFanLines(s, makeRec({}), ctx);
    const after = getActiveRng().getState();
    expect(after).toEqual(before);
  });
});

// T-10-034: 맞는 버킷이 모자라면 아무 버킷에서나 채워 평범한 시즌에도 우승·이적·부상 반응이 섞였다.
it('평범한 시즌에는 성적과 무관한 응원으로만 채운다(우승·이적·부상 반응 없음)', async () => {
  const { FAN_LINES } = await import('./fanfeed-data.js');
  const wrong = new Set([
    ...FAN_LINES.rank_champion,
    ...FAN_LINES.trophy,
    ...FAN_LINES.transfer,
    ...FAN_LINES.injury,
    ...FAN_LINES.milestone,
  ]);
  setActiveRng(createRng(9));
  const s = newGame(
    { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    9,
  );
  s.fame = 60; // 4줄 — 인기 구간 목소리가 없는 구간이라 성적·응원 반응만.
  for (let i = 0; i < 300; i++) {
    s.cid = `cid-${i}`;
    const lines = pickFanLines(
      s,
      makeRec({ year: 2026 + (i % 10), rank: 9, rating: 6.9, goals: 4, apps: 20 }),
      ctx,
    );
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.filter((l) => wrong.has(l))).toEqual([]);
  }
});

// T-11-264 지난 시즌과 견준 흐름 — 좋아진 시즌·나빠진 시즌에 그 반응이 섞이고, 평범한 시즌엔 섞이지 않는다.
it('흐름이 상승·하락이면 그 버킷 문장이 섞이고, 흐름이 없으면 섞이지 않는다', async () => {
  const { FAN_LINES } = await import('./fanfeed-data.js');
  const up = new Set(FAN_LINES.trend_up);
  const down = new Set(FAN_LINES.trend_down);
  expect(up.size).toBe(5);
  expect(down.size).toBe(5);
  setActiveRng(createRng(11));
  const s = newGame(
    { name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    11,
  );
  s.fame = 60;
  const rec = makeRec({ rank: 9, rating: 6.9, goals: 4, apps: 20 });
  let sawUp = 0;
  let sawDown = 0;
  for (let i = 0; i < 100; i++) {
    s.cid = `cid-${i}`;
    const upLines = pickFanLines(s, rec, { ...ctx, trend: 'up' });
    const downLines = pickFanLines(s, rec, { ...ctx, trend: 'down' });
    const noneLines = pickFanLines(s, rec, { ...ctx, trend: null });
    sawUp += upLines.some((l) => up.has(l)) ? 1 : 0;
    sawDown += downLines.some((l) => down.has(l)) ? 1 : 0;
    expect(upLines.filter((l) => down.has(l))).toEqual([]);
    expect(downLines.filter((l) => up.has(l))).toEqual([]);
    expect(noneLines.filter((l) => up.has(l) || down.has(l))).toEqual([]);
  }
  expect(sawUp).toBeGreaterThan(0);
  expect(sawDown).toBeGreaterThan(0);
});
