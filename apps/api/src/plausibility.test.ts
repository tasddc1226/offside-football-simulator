import { describe, expect, it } from 'vitest';
import { CONTROL_BASE, CONTROL_CAP, CONTROL_W } from '@offside/contracts/hof-rules';
import { boundRetirement, type StoredSeason } from './plausibility.js';

const seasons: StoredSeason[] = Array.from({ length: 10 }, (_, i) => ({
  year: 2030 + i,
  age: 20 + i,
  apps: 30,
  goals: 3,
  assists: 5,
  rating: CONTROL_BASE + CONTROL_CAP,
  cs: 0,
  caps: 0,
  ovr: 80,
  honors: [],
}));
const summary = {
  retireAge: 30,
  peak: 80,
  legendScore: 99_999,
  apps: 300,
  goals: 30,
  assists: 50,
  trophies: 0,
  awards: 0,
  caps: 0,
  ballon: 0,
  lastClub: '테스트 FC',
};

describe('boundRetirement 경기 장악 (T-11-021)', () => {
  it('중앙 미드필더의 레전드 점수 상한은 시즌 평점으로 낸 경기 장악만큼 높다', () => {
    const plain = boundRetirement('MF', summary, seasons)!.legendScore;
    const cm = boundRetirement('MF', summary, seasons, 'CM')!.legendScore;
    // 10시즌 × 30경기 × 평점 초과분(상한)
    expect(Math.abs(cm - plain - 300 * CONTROL_CAP * CONTROL_W.CM!)).toBeLessThanOrEqual(1);
    expect(boundRetirement('FW', summary, seasons, 'W')!.legendScore).toBeLessThan(cm);
  });
});
