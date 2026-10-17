import { describe, expect, it } from 'vitest';
import {
  ATTENDANCE_BOARD,
  boardFilled,
  checkInReward,
  nextStamp,
  nextStreak,
  streakAlive,
  weekOf,
} from './attendance-rules.js';

describe('T-11-360 출석 규칙', () => {
  it('도장은 판마다 1~28칸을 채운다', () => {
    expect(boardFilled(0)).toBe(0);
    expect(boardFilled(1)).toBe(1);
    expect(boardFilled(ATTENDANCE_BOARD)).toBe(ATTENDANCE_BOARD);
    expect(boardFilled(ATTENDANCE_BOARD + 1)).toBe(1);
  });

  it('매일 그 칸의 보상을 받는다: 기본 리롤권 1장, 정해진 칸은 강화권 · 스카우트권', () => {
    expect(checkInReward(1)).toEqual({ reroll: 1 });
    expect(checkInReward(4)).toEqual({ boost: 1 });
    expect(checkInReward(7)).toEqual({ boost: 2 });
    expect(checkInReward(14)).toEqual({ scout: 1 });
    expect(checkInReward(28)).toEqual({ scout: 2, boost: 3 });
    expect(checkInReward(29)).toEqual({ reroll: 1 });
    expect(checkInReward(35)).toEqual({ boost: 2 });
    // 한 판(28일) 합계.
    const sum = { reroll: 0, boost: 0, scout: 0 };
    for (let n = 1; n <= ATTENDANCE_BOARD; n++)
      for (const [k, v] of Object.entries(checkInReward(n))) sum[k as keyof typeof sum] += v;
    expect(sum).toEqual({ reroll: 20, boost: 12, scout: 3 });
  });

  it('다음 칸은 채운 칸 다음이고, 판을 다 채우면 다음 판의 1칸이다', () => {
    expect(nextStamp(0)).toEqual({ cell: 1, reward: { reroll: 1 } });
    expect(nextStamp(6)).toEqual({ cell: 7, reward: { boost: 2 } });
    expect(nextStamp(27).cell).toBe(28);
    expect(nextStamp(28)).toEqual({ cell: 1, reward: { reroll: 1 } });
  });

  it('주는 월요일에 시작한다', () => {
    expect(weekOf('2026-10-19')).toBe('2026-10-19'); // 월
    expect(weekOf('2026-10-25')).toBe('2026-10-19'); // 일
    expect(weekOf('2026-10-17')).toBe('2026-10-12'); // 토
  });

  it('하루씩 이어 오면 연속이 오르고, 이틀 넘게 비면 1부터 센다', () => {
    const s = { lastDay: '2026-10-17', streak: 4, graceWeek: null };
    expect(nextStreak(s, '2026-10-18')).toEqual({ streak: 5, graceWeek: null });
    expect(nextStreak(s, '2026-10-20')).toEqual({ streak: 1, graceWeek: null });
    expect(nextStreak({ lastDay: null, streak: 0, graceWeek: null }, '2026-10-18')).toEqual({
      streak: 1,
      graceWeek: null,
    });
  });

  it('한 주에 하루는 빠져도 이어지고, 같은 주에 또 빠지면 끊긴다', () => {
    // 10-18(일)을 빠지고 10-19(월)에 온다 → 빠진 날의 주(10-12 주) 유예를 쓴다.
    const a = nextStreak({ lastDay: '2026-10-17', streak: 4, graceWeek: null }, '2026-10-19');
    expect(a).toEqual({ streak: 5, graceWeek: '2026-10-12' });
    // 다음 주(10-19 주)에 하루를 또 빠지는 건 새 유예다.
    const b = nextStreak(
      { lastDay: '2026-10-20', streak: 6, graceWeek: a.graceWeek },
      '2026-10-22',
    );
    expect(b).toEqual({ streak: 7, graceWeek: '2026-10-19' });
    // 같은 주에 두 번째로 빠지면 끊긴다.
    const s = { lastDay: '2026-10-23', streak: 8, graceWeek: '2026-10-19' };
    expect(streakAlive(s, '2026-10-25')).toBe(false);
    expect(nextStreak(s, '2026-10-25')).toEqual({ streak: 1, graceWeek: '2026-10-19' });
  });

  it('살아 있는 연속인지: 오늘 · 어제 출석, 또는 쓸 수 있는 유예가 있을 때', () => {
    const s = { lastDay: '2026-10-17', streak: 3, graceWeek: null };
    expect(streakAlive(s, '2026-10-17')).toBe(true);
    expect(streakAlive(s, '2026-10-18')).toBe(true);
    expect(streakAlive(s, '2026-10-19')).toBe(true);
    expect(streakAlive(s, '2026-10-20')).toBe(false);
    expect(streakAlive({ lastDay: null, streak: 0, graceWeek: null }, '2026-10-17')).toBe(false);
  });
});
