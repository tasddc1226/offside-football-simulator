import { describe, expect, it } from 'vitest';
import { newGame } from './engine.js';
import { createRng, setActiveRng } from './rng.js';
import { legendScore, legendScoreBreakdown } from './season.js';
import type { CareerRecord } from './types.js';

describe('legendScoreBreakdown', () => {
  it('항목 합계는 legendScore()의 값과 정확히 같다', () => {
    setActiveRng(createRng(3));
    const s = newGame({ name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' }, 3);
    const rec: CareerRecord = {
      year: 2026, age: 19, club: 'x', league: 'K리그1', apps: 30, goals: 18, assists: 6, cs: 0,
      rating: 7.2, rank: 1, ovr: 70, honors: ['우승'], pro: true,
    };
    s.career.push(rec);
    s.trophies.push({ year: 2026, t: '우승', club: 'x' });
    s.peak = 70;
    const { total } = legendScoreBreakdown(s);
    expect(total).toBe(legendScore(s));
  });
});
