import { describe, expect, it } from 'vitest';
import { AD_PLACES, AD_REPEAT_MS, shouldShow, type AdPlace } from './adPolicy.js';

const PLACES = Object.keys(AD_PLACES) as AdPlace[];
const ALL_ON = Object.fromEntries(PLACES.map((p) => [p, true])) as Record<AdPlace, boolean>;

describe('광고 노출 판단', () => {
  const now = 1_000_000;
  it('T-11-720 배너 위치는 모두 꺼져 있다', () => {
    for (const place of PLACES) expect(shouldShow(place, now)).toBe(false);
  });
  it('켜진 위치는 처음 한 번 보인다', () => {
    for (const place of PLACES) expect(shouldShow(place, now, undefined, ALL_ON)).toBe(true);
  });
  it('안 채워진 위치는 다시 요청하지 않는다', () => {
    for (const place of PLACES) expect(shouldShow(place, now, Infinity, ALL_ON)).toBe(false);
  });
  it('같은 위치는 간격 안에 다시 요청하지 않는다', () => {
    for (const place of PLACES) {
      expect(shouldShow(place, now, now - AD_REPEAT_MS + 1, ALL_ON)).toBe(false);
      expect(shouldShow(place, now, now - AD_REPEAT_MS, ALL_ON)).toBe(true);
    }
  });
});
