import { describe, expect, it } from 'vitest';
import { ROLL_SPEED, rollEnd, rollSpeed } from './creditRoll.js';

describe('커리어 재생 (T-10-129)', () => {
  it('마지막 휘슬 가운데가 화면 45%에 오면 멈추고, 문서 끝을 넘지 않는다', () => {
    expect(rollEnd({ top: 3000, height: 400 }, 800, 5000)).toBe(2840);
    expect(rollEnd({ top: 3000, height: 400 }, 800, 2500)).toBe(2500);
    expect(rollEnd(null, 800, 2500)).toBe(2500);
  });
  it('출발할 때 서서히 빨라지고 끝 가까이에서 느려진다', () => {
    expect(rollSpeed(0, 1000)).toBe(0);
    expect(rollSpeed(350, 1000)).toBe(ROLL_SPEED / 2);
    expect(rollSpeed(2000, 1000)).toBe(ROLL_SPEED);
    expect(rollSpeed(2000, 80)).toBe(ROLL_SPEED / 2);
    expect(rollSpeed(2000, 0)).toBeCloseTo(ROLL_SPEED * 0.15);
  });
});
