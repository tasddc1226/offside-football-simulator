import { describe, expect, it } from 'vitest';
import { nextScroll } from './autoTour.js';

const VH = 800;
describe('nextScroll (T-10-127)', () => {
  it('다음 장면 가운데를 화면 40% 높이에 맞춘다', () => {
    // top 1000, 높이 200 → 가운데 1100 - 320 = 780
    expect(
      nextScroll(
        [
          { top: 0, height: 600 },
          { top: 1000, height: 200 },
        ],
        0,
        VH,
        5000,
      ),
    ).toBe(480);
    expect(
      nextScroll(
        [
          { top: 0, height: 600 },
          { top: 1000, height: 200 },
        ],
        480,
        VH,
        5000,
      ),
    ).toBe(780);
  });
  it('화면보다 큰 장면은 머리를 위쪽에 두고, 한 번에 화면 60%까지만 내려간다', () => {
    expect(nextScroll([{ top: 700, height: 2000 }], 0, VH, 5000)).toBe(480);
    expect(nextScroll([{ top: 700, height: 2000 }], 450, VH, 5000)).toBe(604);
  });
  it('이미 지난 장면은 건너뛰고, 더 갈 곳이 없으면 null', () => {
    expect(nextScroll([{ top: 100, height: 100 }], 0, VH, 0)).toBeNull();
    expect(nextScroll([{ top: 1000, height: 200 }], 780, VH, 5000)).toBeNull();
  });
  it('문서 끝을 넘지 않는다', () => {
    expect(nextScroll([{ top: 1000, height: 200 }], 0, VH, 300)).toBe(300);
  });
});
