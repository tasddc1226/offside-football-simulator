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
  const counted = { contributed: 9_000, participants: 1_000 };

  it('T-11-190 진행률은 지난 시간 ÷ 35일 — 완주 수가 목표를 넘어도 앞서지 않는다', () => {
    const a = stepSeasonGauge(null, season, counted, at(7));
    expect(a.peak).toBeCloseTo(0.2);
    expect(a.lockedAt).toBeNull();
    expect(a).toMatchObject(counted);
  });

  it('완주 수로 앞서 있던 옛 최고치는 다음 cron에서 시간 기준으로 돌아간다', () => {
    const old = { ...stepSeasonGauge(null, season, counted, at(4.6)), peak: 0.56 };
    expect(stepSeasonGauge(old, season, counted, at(4.6)).peak).toBeCloseTo(4.6 / 35);
  });

  it('90%(31.5일)에 닿으면 마감을 개막 + 35일로 확정하고, 그 뒤에는 바꾸지 않는다', () => {
    expect(stepSeasonGauge(null, season, counted, at(31)).lockedAt).toBeNull();
    const s = stepSeasonGauge(null, season, counted, at(31.5));
    expect(s.lockedAt).toBe(at(31.5));
    expect(s.endsAt).toBe(at(35));
    expect(stepSeasonGauge(s, season, counted, at(32)).endsAt).toBe(s.endsAt);
  });

  it('언제 확정해도 마감은 개막 + 35일', () => {
    expect(seasonDeadline(season.startsAt, at(1))).toBe(at(35));
    expect(seasonDeadline(season.startsAt, at(34.5))).toBe(at(35));
  });

  it('끝나지 않은 컵이 있으면 마감을 컵 마지막 경기 다음 00:00 KST로 미룬다(시즌 길이보다 컵이 먼저)', () => {
    // 제1회 컵처럼 일찍 끝나는 컵은 마감을 바꾸지 않는다.
    expect(seasonDeadline(season.startsAt, at(31.5), at(10.9))).toBe(at(35));
    // 35일을 넘는 컵은 결승 뒤로.
    expect(seasonDeadline(season.startsAt, at(31.5), at(35.9))).toBe(at(36));
  });

  it('확정 뒤 컵 일정이 늦춰지면 마감을 늦추기만 하고, 당겨져도 마감은 그대로다', () => {
    const s = stepSeasonGauge(null, season, counted, at(31.5), at(34.9));
    expect(s.endsAt).toBe(at(35));
    expect(stepSeasonGauge(s, season, counted, at(32), at(33.5)).endsAt).toBe(at(35));
    expect(stepSeasonGauge(s, season, counted, at(32), at(36.9)).endsAt).toBe(at(37));
    expect(stepSeasonGauge(s, season, counted, at(32), null).endsAt).toBe(at(35));
  });

  it('확정 전에는 90% 아래, 확정 뒤에는 마감 시각에 정확히 100%', () => {
    const open = stepSeasonGauge(null, season, counted, at(14));
    expect(seasonGaugeProgress(open, season.startsAt, at(14))).toBeCloseTo(0.4);
    const locked = stepSeasonGauge(open, season, counted, at(31.5));
    expect(seasonGaugeProgress(locked, season.startsAt, at(31.5))).toBeCloseTo(0.9);
    expect(seasonGaugeProgress(locked, season.startsAt, locked.endsAt!)).toBe(1);
    const view = seasonGaugeView(locked, season.startsAt, at(31.5));
    expect(view).toMatchObject({ target: 10_000, minEndsAt: at(35), maxEndsAt: at(35) });
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
