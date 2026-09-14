import { describe, expect, it } from 'vitest';
import {
  careerStartYear,
  extractCalendarStartYear,
  FALLBACK_CAREER_START_YEAR,
  seasonYear,
  seasonYearLabel,
  seasonYearLabelWithOrdinal,
  seasonYearRangeLabel,
} from './season-year.js';

describe('careerStartYear', () => {
  it('(1) 커리어 시즌의 serviceSeasonId가 지금 라이브 서비스 시즌과 같으면 그 startsAt의 연도를 쓴다', () => {
    expect(
      careerStartYear({
        seasonServiceSeasonId: 'svc_season_1',
        currentServiceSeason: { id: 'svc_season_1', startsAt: '2026-09-05T00:00:00Z' },
        calendarStartYear: 1999,
      }),
    ).toBe(2026);
  });

  it('(2) serviceSeasonId가 없거나 라이브 서비스 시즌과 다르면 룰셋 calendarStartYear를 쓴다', () => {
    expect(
      careerStartYear({
        seasonServiceSeasonId: null,
        currentServiceSeason: { id: 'svc_season_2', startsAt: '2031-01-01T00:00:00Z' },
        calendarStartYear: 2029,
      }),
    ).toBe(2029);
    expect(
      careerStartYear({
        seasonServiceSeasonId: 'svc_season_1',
        currentServiceSeason: { id: 'svc_season_2', startsAt: '2031-01-01T00:00:00Z' },
        calendarStartYear: 2029,
      }),
    ).toBe(2029);
  });

  it('(3) 둘 다 없으면 폴백 2026을 쓴다', () => {
    expect(
      careerStartYear({ seasonServiceSeasonId: null, currentServiceSeason: null }),
    ).toBe(FALLBACK_CAREER_START_YEAR);
    expect(
      careerStartYear({ seasonServiceSeasonId: null, currentServiceSeason: undefined, calendarStartYear: null }),
    ).toBe(2026);
  });
});

describe('extractCalendarStartYear', () => {
  it('startYear가 유한한 숫자면 그 값을 돌려준다', () => {
    expect(extractCalendarStartYear({ startYear: 2030 })).toBe(2030);
  });

  it('필드가 없거나 값이 숫자가 아니거나 calendar 자체가 없으면 null', () => {
    expect(extractCalendarStartYear({ id: 'default' })).toBeNull();
    expect(extractCalendarStartYear({ startYear: 'NEXT_YEAR' })).toBeNull();
    expect(extractCalendarStartYear(null)).toBeNull();
    expect(extractCalendarStartYear(undefined)).toBeNull();
  });
});

describe('seasonYear·라벨 포맷터', () => {
  it('seasonYear: 시즌 index(1부터)를 시작 연도에 더한다', () => {
    expect(seasonYear(2026, 1)).toBe(2026);
    expect(seasonYear(2026, 3)).toBe(2028);
  });

  it('seasonYearLabel: 기본 표기 "N 시즌"', () => {
    expect(seasonYearLabel(2026, 1)).toBe('2026 시즌');
    expect(seasonYearLabel(2026, 5)).toBe('2030 시즌');
  });

  it('seasonYearLabelWithOrdinal: 몇 번째 시즌인지 보조 표기를 덧붙인다', () => {
    expect(seasonYearLabelWithOrdinal(2026, 3)).toBe('2028 시즌 (3번째)');
    expect(seasonYearLabelWithOrdinal(2026, 1)).toBe('2026 시즌 (1번째)');
  });

  it('seasonYearRangeLabel: 시작~끝이 다르면 "from–to", 같으면 한 해만', () => {
    expect(seasonYearRangeLabel(2026, 1, 16)).toBe('2026–2041');
    expect(seasonYearRangeLabel(2026, 1, 1)).toBe('2026');
  });
});
