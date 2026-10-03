import { describe, expect, it } from 'vitest';
import { AD_PLACES, AD_REPEAT_MS, shouldShow } from './adPolicy.js';

describe('광고 노출 판단', () => {
  const ctx = { sheet: false, now: 1_000_000 };
  it('켜진 1단계 위치는 처음 한 번 보인다', () => {
    for (const place of Object.keys(AD_PLACES) as (keyof typeof AD_PLACES)[])
      expect(shouldShow(place, ctx)).toBe(true);
  });
  it('업무 모드와 안 채워진 위치는 그리지 않는다', () => {
    expect(shouldShow('records-bottom', { ...ctx, sheet: true })).toBe(false);
    expect(shouldShow('records-bottom', { ...ctx, unfilled: true })).toBe(false);
  });
  it('같은 위치는 간격 안에 다시 요청하지 않는다', () => {
    const lastShown = ctx.now - AD_REPEAT_MS + 1;
    expect(shouldShow('board-bottom', { ...ctx, lastShown })).toBe(false);
    expect(shouldShow('board-bottom', { ...ctx, lastShown: ctx.now - AD_REPEAT_MS })).toBe(true);
  });
});
