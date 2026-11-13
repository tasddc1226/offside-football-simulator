import { describe, expect, it } from 'vitest';
import { DAILY_COLORS, SPECIAL_COLORS, specialRibbon } from './cardSpecial.js';

describe('카드 띠 표식', () => {
  it('T-11-723 오늘의 랭킹 순위는 금 · 은 · 동 색으로 순위만 적는다', () => {
    expect(specialRibbon(undefined, 1)).toMatchObject({
      kind: 'daily',
      text: '데일리 1위',
      aria: '오늘의 랭킹 1위 카드',
      color: DAILY_COLORS[0],
    });
    expect(specialRibbon([], 3)?.color).toBe(DAILY_COLORS[2]);
    expect(specialRibbon([], 2)?.text).toBe('데일리 2위');
  });

  it('시즌 표식이 있으면 시즌 표식이 먼저다', () => {
    const r = specialRibbon([{ season: 2, kind: 'mvp', rank: 1 }], 1);
    expect(r).toMatchObject({ kind: 'mvp', season: 2, color: SPECIAL_COLORS.mvp });
    expect(r?.text).toContain('MVP');
  });

  it('표식이 없거나 순위가 범위를 벗어나면 그리지 않는다', () => {
    expect(specialRibbon(null)).toBeNull();
    expect(specialRibbon([], null)).toBeNull();
    expect(specialRibbon([], 0)).toBeNull();
    expect(specialRibbon([], 4)).toBeNull();
  });
});
