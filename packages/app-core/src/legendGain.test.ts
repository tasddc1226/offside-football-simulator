import { describe, expect, it } from 'vitest';
import { legendGain } from './legendGain';

describe('T-11-813 season review legend gain', () => {
  it('hides the line for old saves and seasons with no gain', () => {
    expect(legendGain(undefined, 900)).toBeNull();
    expect(legendGain(900, 900)).toBeNull();
  });
  it('shows the gain and current score without a cross note below the lines', () => {
    expect(legendGain(800, 1_050)).toEqual({
      line: '레전드 점수 +250점 · 지금 1,050점',
      cross: null,
    });
  });
  it('notes crossing the legend line and the icon line', () => {
    expect(legendGain(1_050, 1_120)?.cross).toBe(
      '레전드 카드 기준(1,100점)을 넘었어요. 지금 기록이면 레전드 카드예요.',
    );
    expect(legendGain(1_750, 1_830)?.cross).toBe(
      '아이콘 카드 기준(1,800점)을 넘었어요. 지금 기록이면 아이콘 카드예요.',
    );
    // 한 시즌에 두 기준을 함께 넘으면 높은 쪽만.
    expect(legendGain(1_000, 1_900)?.cross).toContain('아이콘');
    expect(legendGain(1_200, 1_400)?.cross).toBeNull();
  });
});
