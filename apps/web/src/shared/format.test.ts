import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './format.js';

const NOW = new Date('2026-09-02T12:00:00Z').getTime();

describe('formatRelativeTime', () => {
  it('1분 미만이면 "방금"이다', () => {
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString(), NOW)).toBe('방금');
    expect(formatRelativeTime(new Date(NOW).toISOString(), NOW)).toBe('방금');
  });

  it('1분 이상 1시간 미만이면 "n분 전"이다', () => {
    expect(formatRelativeTime(new Date(NOW - 60_000).toISOString(), NOW)).toBe('1분 전');
    expect(formatRelativeTime(new Date(NOW - 59 * 60_000).toISOString(), NOW)).toBe('59분 전');
  });

  it('1시간 이상이면 "n시간 전"이다', () => {
    expect(formatRelativeTime(new Date(NOW - 60 * 60_000).toISOString(), NOW)).toBe('1시간 전');
    expect(formatRelativeTime(new Date(NOW - 5 * 60 * 60_000).toISOString(), NOW)).toBe('5시간 전');
  });

  it('미래 시각이 들어와도 음수가 되지 않는다', () => {
    expect(formatRelativeTime(new Date(NOW + 60_000).toISOString(), NOW)).toBe('방금');
  });
});
