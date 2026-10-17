import { describe, expect, it } from 'vitest';
import { seasonGaugeLines, type SeasonGauge } from './seasonGauge.js';

const base: SeasonGauge = {
  season: 1,
  startsAt: '2026-10-05T15:00:00.000Z',
  progress: 0.591,
  contributed: 66_240,
  participants: 9_345,
  target: 112_140,
  endsAt: null,
  minEndsAt: '2026-10-19T15:00:00.000Z',
  maxEndsAt: '2026-10-30T15:00:00.000Z',
  updatedAt: '2026-10-17T12:10:00.000Z',
};
const now = Date.parse('2026-10-17T12:10:00.000Z');

describe('시즌 진행 게이지 문구', () => {
  it('마감 전에는 참여자 수와 목표가 같이 커진다는 줄을 보인다', () => {
    const l = seasonGaugeLines(base, now);
    expect(l.pct).toBe(59);
    expect(l.countdown).toBeNull();
    expect(l.why).toBe('9,345명이 함께 채우고 있어요. 참여자가 늘면 목표도 같이 커져요.');
    expect(l.endDate).toBe('빠르면 10월 19일(월), 늦어도 10월 30일(금)까지 열려요');
  });

  it('마감이 정해지면 그 줄 대신 카운트다운만 보인다', () => {
    const l = seasonGaugeLines(
      { ...base, progress: 0.92, endsAt: '2026-10-30T15:00:00.000Z' },
      now,
    );
    expect(l.why).toBeNull();
    expect(l.countdown).toBe('시즌 종료까지 13일 2시간');
    expect(l.endDate).toBe('10월 30일(금)까지 열려요');
  });
});
