import { describe, expect, it } from 'vitest';
import {
  BALANCE_KEYS,
  BALANCE_SPEC,
  BalanceDraftInputSchema,
  BalanceOverridesSchema,
} from './balance.js';

// T-10-016 밸런스 스펙: 기본값이 범위 안이고, 스키마는 범위 밖·모르는 키를 거절한다.
describe('밸런스 스펙 · 스키마', () => {
  it('모든 기본값이 허용 범위 안이다', () => {
    for (const k of BALANCE_KEYS) {
      const s = BALANCE_SPEC[k];
      expect(s.min <= s.def && s.def <= s.max, k).toBe(true);
    }
  });

  it('범위 안 값과 이벤트 맵은 받고, 범위 밖·모르는 키·잘못된 키는 거절한다', () => {
    expect(
      BalanceOverridesSchema.parse({
        growthScale: 1.2,
        eventWeight: { knock: 0 },
        choiceBonus: { 'knock:1': -0.2 },
      }),
    ).toEqual({
      growthScale: 1.2,
      eventWeight: { knock: 0 },
      choiceBonus: { 'knock:1': -0.2 },
    });
    for (const bad of [
      { growthScale: 2 },
      { mystery: 1 },
      { eventWeight: { knock: 6 } },
      { choiceBonus: { knock: 0.1 } },
    ]) {
      expect(BalanceOverridesSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('초안 입력: 메모는 다듬고 기본값은 빈 문자열', () => {
    expect(BalanceDraftInputSchema.parse({ values: {} })).toEqual({ note: '', values: {} });
    expect(BalanceDraftInputSchema.parse({ note: '  상향 ', values: {} }).note).toBe('상향');
    expect(BalanceDraftInputSchema.safeParse({ note: 'x'.repeat(201), values: {} }).success).toBe(
      false,
    );
  });
});
