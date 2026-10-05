import { describe, expect, it } from 'vitest';
import { AD_PLACES, AD_REPEAT_MS, shouldShow, type AdPlace } from './adPolicy.js';

describe('광고 노출 판단', () => {
  const now = 1_000_000;
  it('켜진 위치는 처음 한 번 보인다', () => {
    for (const place of Object.keys(AD_PLACES) as AdPlace[])
      expect(shouldShow(place, now)).toBe(true);
  });
  it('안 채워진 위치는 다시 요청하지 않는다', () => {
    for (const place of Object.keys(AD_PLACES) as AdPlace[])
      expect(shouldShow(place, now, Infinity)).toBe(false);
  });
  it('같은 위치는 간격 안에 다시 요청하지 않는다', () => {
    for (const place of Object.keys(AD_PLACES) as AdPlace[]) {
      expect(shouldShow(place, now, now - AD_REPEAT_MS + 1)).toBe(false);
      expect(shouldShow(place, now, now - AD_REPEAT_MS)).toBe(true);
    }
  });
});
