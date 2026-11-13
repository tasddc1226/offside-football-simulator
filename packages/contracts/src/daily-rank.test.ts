import { describe, expect, it } from 'vitest';
import {
  DAILY_RANK_FIRST_DAY,
  DAILY_RANK_REWARDS,
  DAILY_RANK_WINNERS,
  dailyRankDays,
  dailyRankOpen,
  dailyRankShift,
  dailyRankStart,
  dailyRankWeekStart,
} from './daily-rank.js';

describe('T-11-723 오늘의 랭킹 날짜 규칙', () => {
  it('한국 시각 자정을 날짜 경계로 쓴다', () => {
    // UTC 14:59는 아직 그날, 15:00부터 다음 날이다.
    expect(dailyRankDays('2026-11-13T14:59:59.000Z')).toEqual({
      today: '2026-11-13',
      yesterday: '2026-11-12',
      resetAt: '2026-11-13T15:00:00.000Z',
    });
    expect(dailyRankDays('2026-11-13T15:00:00.000Z').today).toBe('2026-11-14');
    expect(dailyRankStart('2026-11-13')).toBe('2026-11-12T15:00:00.000Z');
    expect(dailyRankShift('2026-11-30', 1)).toBe('2026-12-01');
    expect(dailyRankShift('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('한 주는 월요일에 시작한다', () => {
    expect(dailyRankWeekStart('2026-11-09')).toBe('2026-11-09'); // 월
    expect(dailyRankWeekStart('2026-11-13')).toBe('2026-11-09'); // 금
    expect(dailyRankWeekStart('2026-11-15')).toBe('2026-11-09'); // 일
    expect(dailyRankWeekStart('2026-11-16')).toBe('2026-11-16'); // 다음 주 월
  });

  it('첫 날부터 순위를 매긴다', () => {
    expect(dailyRankOpen('2026-11-13')).toBe(false);
    expect(dailyRankOpen(DAILY_RANK_FIRST_DAY)).toBe(true);
    expect(dailyRankOpen('2026-12-01')).toBe(true);
  });

  it('순위마다 줄 아이템이 정해져 있다', () => {
    expect(DAILY_RANK_REWARDS).toHaveLength(DAILY_RANK_WINNERS);
    expect(DAILY_RANK_REWARDS[0]).toEqual({ scout: 1, reroll: 1 });
  });
});
