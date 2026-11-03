import { createRng, setActiveRng } from '@offside/game/rng';
import type { MatchGame } from '@offside/game/match';
import { describe, expect, it } from 'vitest';
import { fakeScore } from './sheet-controller.js';

// T-11-414 수비수 · 골키퍼의 경기별 스코어는 무실점 기록과 맞아야 한다.
const game = (res: MatchGame['res'], cs: boolean, mins = 90, g = 0): MatchGame => ({
  rd: 1,
  res,
  mins,
  g,
  cs,
});
const against = (score: string) => Number(score.split('-')[1]);

describe('fakeScore', () => {
  it('뛴 경기에서 무실점이 아니면 상대가 한 골 이상 넣는다', () => {
    setActiveRng(createRng(7));
    for (let i = 0; i < 500; i++) {
      for (const res of ['W', 'D', 'L'] as const)
        expect(against(fakeScore(game(res, false, 90, i % 3), true))).toBeGreaterThan(0);
      expect(against(fakeScore(game('W', true), true))).toBe(0);
      expect(fakeScore(game('D', true), true)).toBe('0-0');
    }
  });

  it('골과 도움을 서로 다른 팀 득점으로 반영한다', () => {
    setActiveRng(createRng(7));
    for (let i = 0; i < 100; i++)
      for (const res of ['W', 'D', 'L'] as const) {
        const m = { ...game(res, false, 90, i % 4), a: 1 + (i % 3) };
        const [gf, ga] = fakeScore(m, true).split('-').map(Number);
        expect(gf!).toBeGreaterThanOrEqual(m.g! + m.a);
        expect(Math.sign(gf! - ga!)).toBe(res === 'W' ? 1 : res === 'L' ? -1 : 0);
      }
  });

  it('승패는 그대로다', () => {
    setActiveRng(createRng(11));
    for (let i = 0; i < 300; i++) {
      const [w1, w2] = fakeScore(game('W', false, 60, 1), true)
        .split('-')
        .map(Number);
      expect(w1!).toBeGreaterThan(w2!);
      const [d1, d2] = fakeScore(game('D', false), true).split('-').map(Number);
      expect(d1).toBe(d2);
    }
  });

  it('공격수 · 출전 없는 경기는 예전처럼 1-0 · 0-0도 나온다', () => {
    setActiveRng(createRng(3));
    const seen = new Set(Array.from({ length: 300 }, () => fakeScore(game('W', false))));
    expect([...seen].some((x) => against(x) === 0)).toBe(true);
    const bench = new Set(Array.from({ length: 300 }, () => fakeScore(game('D', false, 0), true)));
    expect(bench.has('0-0')).toBe(true);
  });
});
