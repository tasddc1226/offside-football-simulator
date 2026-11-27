import { describe, expect, it } from 'vitest';
import {
  CARD_VALUE_FLOOR,
  cardAgeMult,
  cardValue,
  fmtValue,
  peakValue,
  releasePayout,
  retireValue,
  rowLeague,
  salaryFor,
  saleCeilingBase,
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
  it('T-11-080 카드 기준가 = 최고 OVR 시즌 중 가장 비싼 값, 0이면 가장 비싼 프로 시즌, 그래도 없으면 1억', () => {
    const pro = (n: number) => Array.from({ length: n }, () => row({ ovr: 60, age: 20 }));
    const card = (o: number, age: number) =>
      Math.round((salaryFor('pl', o) * cardAgeMult(age)) / 100) * 100;
    // T-11-422 같은 OVR로 30세를 넘겨 뛰어도 기준가가 줄지 않는다(30세에 은퇴한 카드와 같다).
    const car = [...pro(9), row({ ovr: 88, age: 29 }), row({ ovr: 88, age: 31 }), row({ ovr: 80 })];
    expect(cardValue(car, 88)).toBe(card(88, 29));
    expect(cardValue(car, 88)).toBe(cardValue(car.slice(0, 10), 88));
    expect(cardValue(car, 88)).toBeGreaterThan(card(88, 31));
    // 최고 OVR 시즌이 복무 시즌이면 가장 비쌌던 프로 시즌
    const mil = [...pro(9), row({ ovr: 82 }), row({ ovr: 84, league: '병역', mil: true })];
    expect(cardValue(mil, 84)).toBe(card(82, 25));
    expect(cardValue([row({ league: 'U리그 (대학)', ovr: 70 })], 70)).toBe(CARD_VALUE_FLOOR);
  });
  it('T-11-821 카드 기준가의 나이 배수는 4 · 4 · 3이고 프로 10시즌 미만은 뛴 시즌만큼만 받는다', () => {
    const young = (n: number) => Array.from({ length: n }, () => row({ ovr: 70, age: 20 }));
    const full = (o: number, age: number) =>
      Math.round((salaryFor('pl', o) * cardAgeMult(age)) / 100) * 100;
    // 24세 이하 웃돈이 없고(몸값은 5배), 30세부터는 3배(몸값은 2배).
    expect([cardAgeMult(24), cardAgeMult(29), cardAgeMult(30)]).toEqual([4, 4, 3]);
    // 24세에 OVR 90을 찍고 프로 6시즌 뒤 은퇴: 전액의 60%.
    const farm = [...young(5), row({ ovr: 90, age: 24 })];
    expect(cardValue(farm, 90)).toBe(Math.round((full(90, 24) * 0.6) / 100) * 100);
    expect(cardValue(farm, 90)).toBeLessThan(valueFor('pl', 90, 24) / 2);
    // 고교 · 대학 · 복무 시즌은 연차로 세지 않는다.
    const uni = [
      row({ league: 'U리그 (대학)', ovr: 60 }),
      row({ league: '병역', mil: true, ovr: 60 }),
      ...farm,
    ];
    expect(cardValue(uni, 90)).toBe(cardValue(farm, 90));
    // 10시즌을 채우면 전액이고 더 뛰어도 늘지 않는다.
    const ten = [...young(9), row({ ovr: 90, age: 28 })];
    expect(cardValue(ten, 90)).toBe(full(90, 28));
    expect(cardValue([...ten, row({ ovr: 85, age: 34 })], 90)).toBe(full(90, 28));
    // 30세 넘어 최고 OVR을 찍은 완주 카드는 예전(2배)보다 높다.
    const late = [...young(12), row({ ovr: 95, age: 32 })];
    expect(cardValue(late, 95)).toBe(full(95, 32));
    expect(cardValue(late, 95)).toBeGreaterThan(valueFor('pl', 95, 32));
    // 한 시즌만 뛴 프로도 1억 밑으로 내려가지 않는다.
    expect(cardValue([row({ league: 'K3리그', ovr: 40, age: 20 })], 40)).toBe(CARD_VALUE_FLOOR);
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

describe('releasePayout (T-11-104 방출 지급)', () => {
  it('카드 기준가 × 지급률을 천만 단위로 반올림하고, 기준가가 없으면 1억으로 본다', () => {
    expect(releasePayout(1_234_567, 1)).toBe(1_235_000);
    expect(releasePayout(1_000_000, 0.5)).toBe(500_000);
    expect(releasePayout(null, 1)).toBe(CARD_VALUE_FLOOR);
  });
});

it('uses PL finances only for the top-five listing ceiling, including legacy prices', () => {
  const season = (league: string) => [row({ league, age: 24 })];
  const pl = season('프리미어리그');
  for (const league of ['라리가', '프리미어리그', 'K리그1']) {
    const rows = season(league);
    const value = cardValue(rows, 80);
    const legacy = seasonValue(rows[0]!);
    expect(saleCeilingBase(rows, 80, value)).toBe(league === 'K리그1' ? value : cardValue(pl, 80));
    expect(saleCeilingBase(rows, 80, legacy)).toBe(
      league === 'K리그1' ? legacy : seasonValue(pl[0]!),
    );
    expect(saleCeilingBase([], 80, value)).toBe(value);
  }
});
