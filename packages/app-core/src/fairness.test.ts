import { describe, expect, it } from 'vitest';
import { gradeOf } from '@offside/game/stats';
import { BALANCE_KEYS, BALANCE_SPEC } from '@offside/contracts/balance';
import { atLeastOneOf3, fairnessView, gradeOdds, GRADES, historyRows, oddsPct } from './fairness';
import { balanceKeysText } from './i18n/ko/balanceKeys';

describe('fairness', () => {
  it('등급 확률은 합이 1이고 기본값(평균 75, 편차 6)에서 S는 1% 미만이다', () => {
    const o = gradeOdds(75, 6);
    expect(GRADES.reduce((a, g) => a + o[g], 0)).toBeCloseTo(1, 6);
    expect(o.S).toBeGreaterThan(0.006);
    expect(o.S).toBeLessThan(0.01);
    expect(atLeastOneOf3(o.S)).toBeCloseTo(0.0233, 3);
  });

  it('계산한 확률이 같은 방식의 표본 추출과 맞는다', () => {
    // 시드 고정(mulberry32) Box–Muller로 candidates.ts와 같은 반올림·등급 규칙을 흉내 낸다.
    let x = 12345;
    const rnd = () => {
      x = (x + 0x6d2b79f5) | 0;
      let t = Math.imul(x ^ (x >>> 15), 1 | x);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
    };
    const n = 200_000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const z = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
      const g = gradeOf(Math.max(55, Math.min(96, Math.round(74 + z * 8))));
      count[g] = (count[g] ?? 0) + 1;
    }
    const o = gradeOdds(74, 8);
    for (const g of GRADES) expect((count[g] ?? 0) / n).toBeCloseTo(o[g], 2);
  });

  it('표는 기본 밸런스와 강화 4단계를 담는다', () => {
    const v = fairnessView();
    expect(v.pot.map(([g, season]) => `${g} ${season}`)).toEqual([
      'S 0.8%',
      'A 7.0%',
      'B 26.0%',
      'C 48.2%',
      'D 18.0%',
    ]);
    expect(v.boost.map(([, p]) => p)).toEqual(['50%', '35%', '25%', '15%']);
    expect(oddsPct(0.0004)).toBe('<0.1%');
    expect(oddsPct(0.026)).toBe('2.6%');
  });

  it('이력은 바로 앞 버전(맨 처음은 기본값)과 달라진 항목만 보여 준다', () => {
    const rows = historyRows({
      versions: [
        {
          version: 2,
          values: { potMean: 76, eventWeight: { knock: 2 } },
          activatedAt: '2026-10-02T00:00:00.000Z',
          active: true,
        },
        {
          version: 1,
          values: { potMean: 76, injuryRate: 0.01 },
          activatedAt: '2026-10-01T00:00:00.000Z',
          active: false,
        },
      ],
    });
    expect(rows[0]!.changes).toEqual([
      [balanceKeysText.injuryRate, '1% → 1.2%'],
      [balanceKeysText.eventWeight({ n: 1 }), ''],
    ]);
    expect(rows[1]!.changes).toEqual([
      [balanceKeysText.potMean, '75 → 76'],
      [balanceKeysText.injuryRate, '1.2% → 1%'],
    ]);
  });

  it('밸런스 항목 이름은 운영 도구 이름(스펙 label)과 같다', () => {
    for (const k of BALANCE_KEYS) expect(balanceKeysText[k], k).toBe(BALANCE_SPEC[k].label);
  });
});
