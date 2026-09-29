import { describe, expect, it } from 'vitest';
import {
  fmtValue,
  peakValue,
  retireValue,
  rowLeague,
  salaryFor,
  seasonValue,
  valueFor,
  type ValueRow,
} from './market-value.js';

const row = (p: Partial<ValueRow & { year: number }>): ValueRow & { year: number } => ({
  year: 2030,
  age: 25,
  league: '프리미어리그',
  ovr: 80,
  ...p,
});

describe('T-10-100 몸값', () => {
  it('연봉은 리그 자금력 × OVR, valueFor는 이적료 기준이던 예전 식과 같다', () => {
    expect(salaryFor('pl', 60)).toBe(40000);
    expect(salaryFor('k3', 70)).toBe(Math.round((1.5 * 1000 * Math.exp(1)) / 10) * 10);
    for (const lg of ['k3', 'k1', 'pl'])
      for (const o of [45, 70, 95])
        for (const age of [19, 24, 25, 29, 30, 36])
          expect(valueFor(lg, o, age)).toBe(
            Math.round((salaryFor(lg, o) * (age <= 24 ? 5 : age <= 29 ? 4 : 2)) / 100) * 100,
          );
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
    const car = [
      row({ ovr: 90, year: 2031 }),
      row({ ovr: 85 }),
      row({ ovr: 70 }),
      row({ ovr: 60 }),
    ];
    const top = [90, 85, 70].map((o) => valueFor('pl', o, 25));
    const want = Math.round((((top[0]! + top[1]! + top[2]!) / 3) * 3) / 1000) * 1000;
    expect(retireValue(car, 500)).toBe(want);
    expect(peakValue(car)?.row.year).toBe(2031);
    // 두 시즌뿐이면 모자란 한 시즌은 0으로 친다
    expect(retireValue(car.slice(0, 1), 0)).toBe(Math.round(top[0]! / 3 / 1000) * 1000);
  });
});

describe('fmtValue (T-10-100 몸값)', () => {
  it('큰 두 단위까지만 쓴다(조·억 / 억·천만 / 천·백만)', () => {
    expect(fmtValue(0)).toBe('-');
    expect(fmtValue(40)).toBe('1백만 미만');
    expect(fmtValue(100)).toBe('1백만');
    expect(fmtValue(3000)).toBe('3천만');
    expect(fmtValue(5300)).toBe('5천 3백만');
    expect(fmtValue(9_960)).toBe('1억');
    expect(fmtValue(35_200)).toBe('3억 5천만');
    expect(fmtValue(2_410_000)).toBe('241억');
    expect(fmtValue(11_153_000)).toBe('1,115억 3천만');
    expect(fmtValue(123_456_789)).toBe('1조 2,346억');
    expect(fmtValue(99_999_000)).toBe('1조');
    expect(fmtValue(100_000_000)).toBe('1조');
  });
});
