import { describe, expect, it } from 'vitest';
import { seasonGaugeLines, type SeasonGauge } from './seasonGauge.js';

const gauge = (over: Partial<SeasonGauge> = {}): SeasonGauge => ({
  season: 1,
  startsAt: '2026-10-05T15:00:00.000Z',
  progress: 0.13,
  contributed: 0,
  participants: 0,
  target: 10,
  endsAt: null,
  minEndsAt: '2026-11-09T15:00:00.000Z',
  maxEndsAt: '2026-11-09T15:00:00.000Z',
  updatedAt: '2026-10-10T05:45:00.000Z',
  ...over,
});
const now = Date.parse('2026-11-08T12:00:00.000Z');

describe('시즌 진행 게이지 문구', () => {
  it('T-11-190 시즌 길이가 정해져 있으면 마감 확정 전에도 남은 시간을 보인다', () => {
    expect(seasonGaugeLines(gauge(), now).countdown).toBe('시즌 종료까지 1일 3시간');
  });
  it('최소·최대 마감이 다르고 아직 확정 전이면 남은 시간이 없다', () => {
    expect(
      seasonGaugeLines(gauge({ minEndsAt: '2026-10-12T15:00:00.000Z' }), now).countdown,
    ).toBeNull();
  });
  it('확정한 마감(컵으로 미뤄진 마감 포함)을 먼저 본다', () => {
    expect(seasonGaugeLines(gauge({ endsAt: '2026-11-10T15:00:00.000Z' }), now).countdown).toBe(
      '시즌 종료까지 2일 3시간',
    );
  });
});
