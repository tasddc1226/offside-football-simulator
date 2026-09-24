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
