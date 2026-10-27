import { describe, expect, it } from 'vitest';
import {
  ceilKstMidnight,
  seasonDeadline,
  seasonGaugeProgress,
  seasonGaugeView,
  stepSeasonGauge,
} from './season-gauge.js';

// 2026-10-06 00:00 KST
// 시즌 2부터의 규칙(T-11-528)을 본다. 시즌 1은 옛 규칙(T-11-546, 아래).
const season = { id: 2, startsAt: '2026-10-05T15:00:00.000Z' };
const at = (days: number) =>
  new Date(Date.parse(season.startsAt) + days * 86_400_000).toISOString();

describe('시즌 진행 게이지', () => {
  it('참여 유저 × 29 대비 완주 수로 차고, 새 유저로 비율이 내려가도 뒤로 가지 않는다', () => {
    const a = stepSeasonGauge(null, season, { contributed: 4_500, participants: 1_400 }, at(1));
    expect(a.peak).toBeCloseTo(4_500 / 40_600);
    const b = stepSeasonGauge(a, season, { contributed: 5_000, participants: 3_000 }, at(1.2));
    expect(b.peak).toBe(a.peak);
    expect(b.participants).toBe(3_000);
  });

  it('게이지가 느려도 최대 기간(60일)에 맞춰 시간으로 찬다', () => {
    const s = stepSeasonGauge(null, season, { contributed: 0, participants: 0 }, at(30));
    expect(s.peak).toBeCloseTo(0.5);
    expect(s.lockedAt).toBeNull();
  });

  it('90%에 닿으면 마감을 48시간 뒤 다음 00:00 KST로 확정하고, 그 뒤에는 바꾸지 않는다', () => {
    const s = stepSeasonGauge(null, season, { contributed: 26_100, participants: 1_000 }, at(40.3));
    expect(s.lockedAt).toBe(at(40.3));
    // 40.3일 + 48시간 = 42.3일 → 43일째 00:00 KST
    expect(s.endsAt).toBe(at(43));
    const t = stepSeasonGauge(s, season, { contributed: 27_000, participants: 1_000 }, at(41));
    expect(t.endsAt).toBe(s.endsAt);
  });

  it('너무 빨리 차도 최소 30일, 늦게 차도 최대 60일을 지킨다', () => {
    expect(seasonDeadline(season.startsAt, at(1))).toBe(at(30));
    expect(seasonDeadline(season.startsAt, at(59))).toBe(at(60));
  });

  it('끝나지 않은 컵이 있으면 마감을 컵 마지막 경기 다음 00:00 KST로 미룬다(최대 기간보다 컵이 먼저)', () => {
    // 40.5일째 확정 → 원래 43일째 00:00 KST. 컵 결승이 44.9일째(21:00 KST)면 45일째 00:00 KST.
    expect(seasonDeadline(season.startsAt, at(40.5), at(44.9))).toBe(at(45));
    // 컵이 마감 전에 끝나면 그대로.
    expect(seasonDeadline(season.startsAt, at(40.5), at(41.5))).toBe(at(43));
    // 최대 기간을 넘어도 컵 결승 뒤로.
    expect(seasonDeadline(season.startsAt, at(59), at(61.5))).toBe(at(62));
  });

  it('확정 뒤 컵 일정이 늦춰지면 마감을 늦추기만 하고, 당겨져도 마감은 그대로다', () => {
    const counted = { contributed: 26_100, participants: 1_000 };
    const s = stepSeasonGauge(null, season, counted, at(7.5), at(14.9));
    expect(s.endsAt).toBe(at(30));
    expect(stepSeasonGauge(s, season, counted, at(8), at(9.5)).endsAt).toBe(at(30));
    expect(stepSeasonGauge(s, season, counted, at(8), at(31.9)).endsAt).toBe(at(32));
    expect(stepSeasonGauge(s, season, counted, at(8), null).endsAt).toBe(at(30));
  });

  it('확정 전에는 90% 아래, 확정 뒤에는 마감 시각에 정확히 100%', () => {
    const open = stepSeasonGauge(null, season, { contributed: 23_200, participants: 1_000 }, at(5));
    expect(seasonGaugeProgress(open, season.startsAt, at(5))).toBeCloseTo(0.8);
    const locked = stepSeasonGauge(
      open,
      season,
      { contributed: 26_500, participants: 1_000 },
      at(8),
    );
    expect(seasonGaugeProgress(locked, season.startsAt, at(8))).toBeCloseTo(0.9);
    expect(seasonGaugeProgress(locked, season.startsAt, locked.endsAt!)).toBe(1);
    const view = seasonGaugeView(locked, season.startsAt, at(8));
    expect(view).toMatchObject({ target: 29_000, minEndsAt: at(30), maxEndsAt: at(60) });
  });

  it('00:00 KST 올림', () => {
    expect(new Date(ceilKstMidnight(Date.parse('2026-10-08T03:00:00Z'))).toISOString()).toBe(
      '2026-10-08T15:00:00.000Z',
    );
    expect(new Date(ceilKstMidnight(Date.parse('2026-10-08T15:00:00Z'))).toISOString()).toBe(
      '2026-10-08T15:00:00.000Z',
    );
  });

  it('T-11-546 시즌 1은 옛 규칙(목표 12 · 14~25일): 시간 하한으로 22.5일째 90%에 닿아 25일째(10/31 00:00 KST) 마감', () => {
    const s1 = { id: 1, startsAt: season.startsAt };
    const counted = { contributed: 98_380, participants: 12_885 };
    const before = stepSeasonGauge(null, s1, counted, at(22));
    expect(before.lockedAt).toBeNull();
    const locked = stepSeasonGauge(before, s1, counted, at(22.5));
    expect(locked.lockedAt).toBe(at(22.5));
    expect(locked.endsAt).toBe('2026-10-30T15:00:00.000Z');
    expect(seasonGaugeView(locked, s1.startsAt, at(23))).toMatchObject({
      target: 12 * 12_885,
      maxEndsAt: '2026-10-30T15:00:00.000Z',
    });
  });
});
