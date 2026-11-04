import { describe, expect, it } from 'vitest';
import { BAR_SCROLL_START, nextBarScroll } from './barScroll';

const run = (ys, maxY = 1000, from = BAR_SCROLL_START) =>
  ys.reduce((s, y) => nextBarScroll(s, y, maxY), from);

describe('nextBarScroll', () => {
  it('내리면 숨기고 올리면 다시 보인다', () => {
    const down = run([40, 80]);
    expect(down.hidden).toBe(true);
    expect(run([70, 60], 1000, down).hidden).toBe(false);
  });

  it('작은 흔들림으로는 바뀌지 않는다', () => {
    const down = run([40, 80]);
    expect(run([75, 80, 76], 1000, down).hidden).toBe(true);
    const up = run([70, 60], 1000, down);
    expect(run([65, 60, 64], 1000, up).hidden).toBe(false);
  });

  it('맨 위 근처와 맨 위를 넘은 튕김에서는 언제나 보인다', () => {
    const down = run([40, 80]);
    expect(run([20], 1000, down).hidden).toBe(false);
    expect(run([-30], 1000, down).hidden).toBe(false);
  });

  it('맨 아래에서 튕겨 돌아와도 다시 올라오지 않는다', () => {
    const down = run([500, 1000]);
    expect(run([1060, 1030, 1000], 1000, down).hidden).toBe(true);
  });

  it('스크롤할 만큼 길지 않은 화면에서는 숨기지 않는다', () => {
    expect(run([40, 80], 10).hidden).toBe(false);
  });
});
