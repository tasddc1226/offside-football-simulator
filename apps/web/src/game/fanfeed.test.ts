import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { createRng, getActiveRng, setActiveRng } from './rng.js';
import { pickFanLines } from './fanfeed.js';
import type { CareerRecord } from './types.js';

function makeRec(over: Partial<CareerRecord>): CareerRecord {
  return {
    year: 2026, age: 18, club: 'test', league: 'K리그1', apps: 20, goals: 5, assists: 3, cs: 0,
    rating: 6.9, rank: 4, ovr: 60, honors: [], pro: true, ...over,
  };
}
const ctx = { gotTrophy: false, injuredThisSeason: false, transferredThisSeason: false, hasMilestone: false };

describe('pickFanLines', () => {
  it('항상 3~5줄을 반환하고, 같은 입력에는 같은 결과를 낸다(결정적)', () => {
    setActiveRng(createRng(1));
    const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 1);
    const rec = makeRec({});
    const a = pickFanLines(s, rec, ctx);
    const b = pickFanLines(s, rec, ctx);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.length).toBeLessThanOrEqual(5);
    expect(a).toEqual(b);
  });

  it('메인 게임 RNG 시드 상태를 전혀 소비하지 않는다(결정성 보존)', () => {
    setActiveRng(createRng(42));
    const s = newGame({ name: 'a', number: 1, pos: 'MF', foot: '오른발', type: 'maker', trait: 'late' }, 42);
    const before = getActiveRng().getState();
    pickFanLines(s, makeRec({}), ctx);
    const after = getActiveRng().getState();
    expect(after).toEqual(before);
  });
});

// T-10-034: 맞는 버킷이 모자라면 아무 버킷에서나 채워 평범한 시즌에도 우승·이적·부상 반응이 섞였다.
it('평범한 시즌에는 성적과 무관한 응원으로만 채운다(우승·이적·부상 반응 없음)', async () => {
  const { FAN_LINES } = await import('./fanfeed-data.js');
  const wrong = new Set([...FAN_LINES.rank_champion, ...FAN_LINES.trophy, ...FAN_LINES.transfer, ...FAN_LINES.injury, ...FAN_LINES.milestone]);
  setActiveRng(createRng(9));
  const s = newGame({ name: 'a', number: 1, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 9);
  for (let i = 0; i < 300; i++) {
    s.cid = `cid-${i}`;
    const lines = pickFanLines(s, makeRec({ year: 2026 + (i % 10), rank: 9, rating: 6.9, goals: 4, apps: 20 }), ctx);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.filter((l) => wrong.has(l))).toEqual([]);
  }
});
