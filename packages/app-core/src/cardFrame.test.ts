import { describe, expect, it } from 'vitest';
import { CARD_FRAME_BOT, CARD_FRAME_TOP, cardShieldPath } from './cardFrame';

describe('cardShieldPath', () => {
  it('어깨 · 아래 꼭짓점 높이는 카드 너비에 비례한다', () => {
    // 너비 96 · 높이 174 px → viewBox 100 × 174 그대로(가로 배율 1, 세로 배율 1).
    const d = cardShieldPath(96, 174);
    expect(d.startsWith('M0 15L15.63 15L')).toBe(true);
    expect(d.endsWith('L1.04 148Z')).toBe(true);
  });
  it('카드가 길어져도 위쪽 꼭짓점 높이(px)는 그대로다', () => {
    const short = cardShieldPath(100, 200, 100, 200);
    const tall = cardShieldPath(100, 400, 100, 400);
    expect(short.split('L')[0]).toBe(tall.split('L')[0]);
  });
  it('크기를 모르면 빈 경로', () => {
    expect(cardShieldPath(0, 100)).toBe('');
  });
  it('위 · 아래 조각 높이 합은 너비보다 작다(가운데가 남는다)', () => {
    expect(CARD_FRAME_TOP + CARD_FRAME_BOT).toBeLessThan(1);
  });
});
