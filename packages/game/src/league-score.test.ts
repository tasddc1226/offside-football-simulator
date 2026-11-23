import { describe, expect, it } from 'vitest';
import { leagueScore } from './match.js';
import { createRng } from './rng.js';

describe('league match scores', () => {
  it('includes every personal goal and assist and agrees with the result', () => {
    const random = createRng(771).next;
    for (const result of ['W', 'D', 'L'] as const) {
      for (let i = 0; i < 200; i++) {
        const contributions = (i % 4) + (i % 3);
        const { gf, ga } = leagueScore(result, contributions, false, true, random);
        expect(gf).toBeGreaterThanOrEqual(contributions);
        expect(ga).toBeGreaterThan(0);
        expect(Math.sign(gf - ga)).toBe(result === 'W' ? 1 : result === 'L' ? -1 : 0);
      }
    }
  });

  it('keeps a recorded clean sheet and allows scoreless draws for outfield or absent players', () => {
    const random = createRng(7).next;
    expect(leagueScore('W', 2, true, false, random).ga).toBe(0);
    expect(leagueScore('D', 0, true, false, random)).toEqual({ gf: 0, ga: 0 });
    const goals = Array.from({ length: 100 }, () => leagueScore('D', 0, false, false, random).gf);
    expect(goals).toContain(0);
    expect(new Set(goals).size).toBeGreaterThan(1);
  });
});
