import { describe, expect, it } from 'vitest';
import {
  ceilKstMidnight,
  seasonDeadline,
  seasonGaugeProgress,
  seasonGaugeView,
  stepSeasonGauge,
} from './season-gauge.js';

// 2026-10-06 00:00 KST
const season = { id: 1, startsAt: '2026-10-05T15:00:00.000Z' };
const at = (days: number) =>
  new Date(Date.parse(season.startsAt) + days * 86_400_000).toISOString();

describe('시즌 진행 게이지', () => {
  it('참여 유저 × 10 대비 완주 수로 차고, 새 유저로 비율이 내려가도 뒤로 가지 않는다', () => {
    const a = stepSeasonGauge(null, season, { contributed: 4_500, participants: 1_400 }, at(1));
    expect(a.peak).toBeCloseTo(4_500 / 14_000);
    const b = stepSeasonGauge(a, season, { contributed: 5_000, participants: 3_000 }, at(1.2));
    expect(b.peak).toBe(a.peak);
    expect(b.participants).toBe(3_000);
  });

  it('게이지가 느려도 최대 기간(21일)에 맞춰 시간으로 찬다', () => {
    const s = stepSeasonGauge(null, season, { contributed: 0, participants: 0 }, at(10.5));
    expect(s.peak).toBeCloseTo(0.5);
    expect(s.lockedAt).toBeNull();
  });

  it('90%에 닿으면 마감을 48시간 뒤 다음 00:00 KST로 확정하고, 그 뒤에는 바꾸지 않는다', () => {
    const s = stepSeasonGauge(null, season, { contributed: 9_000, participants: 1_000 }, at(9.3));
    expect(s.lockedAt).toBe(at(9.3));
    // 9.3일 + 48시간 = 11.3일 → 12일째 00:00 KST(10/18 00:00 KST)
    expect(s.endsAt).toBe(at(12));
    const t = stepSeasonGauge(s, season, { contributed: 9_500, participants: 1_000 }, at(10));
    expect(t.endsAt).toBe(s.endsAt);
  });

  it('너무 빨리 차도 최소 7일, 늦게 차도 최대 21일을 지킨다', () => {
    expect(seasonDeadline(season.startsAt, at(1))).toBe(at(7));
    expect(seasonDeadline(season.startsAt, at(20))).toBe(at(21));
  });

  it('확정 전에는 90% 아래, 확정 뒤에는 마감 시각에 정확히 100%', () => {
    const open = stepSeasonGauge(null, season, { contributed: 8_000, participants: 1_000 }, at(5));
    expect(seasonGaugeProgress(open, season.startsAt, at(5))).toBeCloseTo(0.8);
    const locked = stepSeasonGauge(
      open,
      season,
      { contributed: 9_200, participants: 1_000 },
      at(8),
    );
    expect(seasonGaugeProgress(locked, season.startsAt, at(8))).toBeCloseTo(0.9);
    expect(seasonGaugeProgress(locked, season.startsAt, locked.endsAt!)).toBe(1);
    const view = seasonGaugeView(locked, season.startsAt, at(8));
    expect(view).toMatchObject({ target: 10_000, minEndsAt: at(7), maxEndsAt: at(21) });
  });

  it('00:00 KST 올림', () => {
    expect(new Date(ceilKstMidnight(Date.parse('2026-10-08T03:00:00Z'))).toISOString()).toBe(
      '2026-10-08T15:00:00.000Z',
    );
    expect(new Date(ceilKstMidnight(Date.parse('2026-10-08T15:00:00Z'))).toISOString()).toBe(
      '2026-10-08T15:00:00.000Z',
    );
  });
});
