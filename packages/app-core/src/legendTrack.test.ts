import { describe, expect, it } from 'vitest';
import { legendTrack } from './legendTrack.js';

describe('legendTrack', () => {
  it('OVR이 높아도 점수가 모자라면 다음 특별 등급까지 남은 점수를 보여 준다', () => {
    const t = legendTrack(640, 99);
    expect(t.tier).toBe('elite');
    expect(t.pct).toBe(58);
    expect(t.next).toContain('460');
  });

  it('레전드를 넘으면 아이콘까지 남은 점수를 센다', () => {
    const t = legendTrack(1100, 99);
    expect(t.tier).toBe('legend');
    expect(t.next).toContain('700');
    expect(t.pct).toBe(61);
  });

  it('아이콘이면 막대를 채우고 남은 점수를 말하지 않는다', () => {
    const t = legendTrack(2400, 90);
    expect(t.tier).toBe('icon');
    expect(t.pct).toBe(100);
    expect(t.next).not.toMatch(/\d/);
  });

  it('점수가 음수여도 막대는 0에서 멈춘다', () => {
    expect(legendTrack(-5, 60).pct).toBe(0);
  });
});
