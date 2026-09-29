import { describe, expect, it } from 'vitest';
import { salaryFor, valueFor } from './player.js';
import { peakValue, retireValue, rowLeague, seasonValue } from './value.js';
import type { CareerRecord } from './types.js';

const row = (p: Partial<CareerRecord>): CareerRecord => ({
  year: 2030,
  age: 25,
  club: '가상 FC',
  league: '프리미어리그',
  apps: 30,
  goals: 10,
  assists: 5,
  cs: 0,
  rating: 7,
  rank: 3,
  ovr: 80,
  honors: [],
  ...p,
});

describe('T-10-100 몸값', () => {
  it('valueFor는 이적료 기준이던 예전 식과 같다', () => {
    for (const lg of ['k3', 'k1', 'pl'])
      for (const o of [45, 70, 95])
        for (const age of [19, 24, 25, 29, 30, 36])
          expect(valueFor(lg, o, age)).toBe(Math.round((salaryFor(lg, o) * (age <= 24 ? 5 : age <= 29 ? 4 : 2)) / 100) * 100);
  });
  it('구단 id가 없는 옛 기록은 리그 이름으로 리그를 찾는다(상무는 K리그1)', () => {
    expect(rowLeague({ league: '라리가' })?.id).toBe('ll');
    expect(rowLeague({ league: 'K리그1', clubId: 'sangmu' })?.id).toBe('k1');
    expect(rowLeague({ league: '없는 리그', clubId: 'bl-3' })?.id).toBe('bl');
    expect(seasonValue(row({ league: '라리가' }))).toBe(valueFor('ll', 80, 25));
  });
  it('고교·대학·현역 복무 시즌은 몸값이 없다', () => {
    expect(seasonValue(row({ league: '고교 리그' }))).toBe(0);
    expect(seasonValue(row({ league: 'U리그 (대학)' }))).toBe(0);
    expect(seasonValue(row({ league: '병역', mil: true }))).toBe(0);
    expect(peakValue([row({ league: '고교 리그' })])).toBeNull();
  });
  it('은퇴 가치 = 상위 세 시즌 평균 × (1 + 레전드 점수/250), 천만 단위', () => {
    const car = [row({ ovr: 90, year: 2031 }), row({ ovr: 85 }), row({ ovr: 70 }), row({ ovr: 60 })];
    const top = [90, 85, 70].map((o) => valueFor('pl', o, 25));
    const want = Math.round(((top[0]! + top[1]! + top[2]!) / 3) * 3 / 1000) * 1000;
    expect(retireValue(car, 500)).toBe(want);
    expect(peakValue(car)?.row.year).toBe(2031);
    // 두 시즌뿐이면 모자란 한 시즌은 0으로 친다
    expect(retireValue(car.slice(0, 1), 0)).toBe(Math.round(top[0]! / 3 / 1000) * 1000);
  });
});
