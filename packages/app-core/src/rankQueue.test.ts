import { rankPoints } from '@offside/contracts/owner-team';
import { describe, expect, it } from 'vitest';
import type { TeamMatch } from './api/team.js';
import {
  formStreak,
  queueClock,
  queueStep,
  queueWaitMs,
  rankStakes,
  recentForm,
  recentRanked,
  repicksLeft,
  spendRepick,
  winRate,
} from './rankQueue.js';

const RULES = { bounds: [1000, 1100, 1200, 1300, 1400, 1500, 1600], guard: 30 };

const match = (mine: 'home' | 'away', home: number, away: number, friendly?: boolean) =>
  ({
    mine,
    home: { goals: home },
    away: { goals: away },
    ...(friendly ? { friendly } : {}),
  }) as TeamMatch;

describe('T-11-702 다른 상대 찾기 하루 횟수', () => {
  const day1 = new Date('2026-11-11T03:00:00Z');
  it('기록이 없거나 깨졌으면 5번 남는다', () => {
    expect(repicksLeft(null, day1)).toBe(5);
    expect(repicksLeft('x{', day1)).toBe(5);
  });
  it('찾을 때마다 줄고 0 아래로 가지 않는다', () => {
    let raw: string | null = null;
    for (const left of [4, 3, 2, 1, 0, 0]) {
      raw = spendRepick(raw, day1);
      expect(repicksLeft(raw, day1)).toBe(left);
    }
  });
  it('한국 시간 자정이 지나면 다시 5번이다', () => {
    const raw = spendRepick(spendRepick(null, day1), day1);
    expect(repicksLeft(raw, new Date('2026-11-11T14:59:00Z'))).toBe(3);
    expect(repicksLeft(raw, new Date('2026-11-11T15:00:00Z'))).toBe(5);
  });
});

describe('queueWaitMs', () => {
  it('첫 찾기가 다시 찾기보다 길고, 움직임 줄이기면 짧다', () => {
    expect(queueWaitMs({}, () => 0)).toBe(3000);
    expect(queueWaitMs({}, () => 1)).toBe(9800);
    expect(queueWaitMs({ repick: true }, () => 1)).toBe(5000);
    expect(queueWaitMs({ motionOK: false }, () => 1)).toBe(700);
  });
  it('짧은 쪽이 더 자주 나오고 10초를 넘지 않는다', () => {
    expect(queueWaitMs({}, () => 0.5)).toBe(4700);
    for (let i = 0; i <= 100; i++) {
      expect(queueWaitMs({}, () => i / 100)).toBeLessThan(10_000);
      expect(queueWaitMs({ repick: true }, () => i / 100)).toBeLessThan(10_000);
    }
  });
});

describe('T-11-702 다른 상대 찾기 하루 횟수', () => {
  const day1 = new Date('2026-11-11T03:00:00Z');
  it('기록이 없거나 깨졌으면 5번 남는다', () => {
    expect(repicksLeft(null, day1)).toBe(5);
    expect(repicksLeft('x{', day1)).toBe(5);
  });
  it('찾을 때마다 줄고 0 아래로 가지 않는다', () => {
    let raw: string | null = null;
    for (const left of [4, 3, 2, 1, 0, 0]) {
      raw = spendRepick(raw, day1);
      expect(repicksLeft(raw, day1)).toBe(left);
    }
  });
  it('한국 시간 자정이 지나면 다시 5번이다', () => {
    const raw = spendRepick(spendRepick(null, day1), day1);
    expect(repicksLeft(raw, new Date('2026-11-11T14:59:00Z'))).toBe(3);
    expect(repicksLeft(raw, new Date('2026-11-11T15:00:00Z'))).toBe(5);
  });
});

describe('queueClock · queueStep', () => {
  it('분:초로 적는다', () => {
    expect(queueClock(0)).toBe('00:00');
    expect(queueClock(65)).toBe('01:05');
  });
  it('시간이 지나면 다음 문구로 넘어가고 마지막에 머문다', () => {
    expect(queueStep(0)).not.toBe(queueStep(2));
    expect(queueStep(4)).toBe(queueStep(100));
  });
});

describe('T-11-702 다른 상대 찾기 하루 횟수', () => {
  const day1 = new Date('2026-11-11T03:00:00Z');
  it('기록이 없거나 깨졌으면 5번 남는다', () => {
    expect(repicksLeft(null, day1)).toBe(5);
    expect(repicksLeft('x{', day1)).toBe(5);
  });
  it('찾을 때마다 줄고 0 아래로 가지 않는다', () => {
    let raw: string | null = null;
    for (const left of [4, 3, 2, 1, 0, 0]) {
      raw = spendRepick(raw, day1);
      expect(repicksLeft(raw, day1)).toBe(left);
    }
  });
  it('한국 시간 자정이 지나면 다시 5번이다', () => {
    const raw = spendRepick(spendRepick(null, day1), day1);
    expect(repicksLeft(raw, new Date('2026-11-11T14:59:00Z'))).toBe(3);
    expect(repicksLeft(raw, new Date('2026-11-11T15:00:00Z'))).toBe(5);
  });
});

describe('recentForm · formStreak', () => {
  it('내 쪽 기준으로 결과를 읽고 친선전은 뺀다', () => {
    const form = recentForm([
      match('home', 2, 1),
      match('away', 2, 1),
      match('home', 3, 0, true),
      match('away', 1, 1),
    ]);
    expect(form).toEqual(['w', 'l', 'd']);
  });
  it('랭크 경기만 최신 순서 그대로 고른다', () => {
    const list = [match('home', 1, 0, true), match('home', 2, 1), match('away', 0, 3)];
    expect(recentRanked(list)).toEqual([list[1], list[2]]);
  });
  it('앞에서부터 다섯 경기만 본다', () => {
    expect(recentForm(Array.from({ length: 8 }, () => match('home', 1, 0)))).toHaveLength(5);
  });
  it('연승 · 연패는 2경기부터, 무승부로 시작하면 없다', () => {
    expect(formStreak(['w', 'w', 'l'])).toContain('2');
    expect(formStreak(['l', 'l', 'l'])).toContain('3');
    expect(formStreak(['w', 'l'])).toBeNull();
    expect(formStreak(['d', 'w', 'w'])).toBeNull();
    expect(formStreak([])).toBeNull();
  });
});

describe('T-11-702 다른 상대 찾기 하루 횟수', () => {
  const day1 = new Date('2026-11-11T03:00:00Z');
  it('기록이 없거나 깨졌으면 5번 남는다', () => {
    expect(repicksLeft(null, day1)).toBe(5);
    expect(repicksLeft('x{', day1)).toBe(5);
  });
  it('찾을 때마다 줄고 0 아래로 가지 않는다', () => {
    let raw: string | null = null;
    for (const left of [4, 3, 2, 1, 0, 0]) {
      raw = spendRepick(raw, day1);
      expect(repicksLeft(raw, day1)).toBe(left);
    }
  });
  it('한국 시간 자정이 지나면 다시 5번이다', () => {
    const raw = spendRepick(spendRepick(null, day1), day1);
    expect(repicksLeft(raw, new Date('2026-11-11T14:59:00Z'))).toBe(3);
    expect(repicksLeft(raw, new Date('2026-11-11T15:00:00Z'))).toBe(5);
  });
});

describe('winRate', () => {
  it('치른 경기가 없으면 null', () => {
    expect(winRate({ w: 0, d: 0, l: 0 })).toBeNull();
    expect(winRate({ w: 2, d: 1, l: 1 })).toBe(50);
  });
});

describe('T-11-702 다른 상대 찾기 하루 횟수', () => {
  const day1 = new Date('2026-11-11T03:00:00Z');
  it('기록이 없거나 깨졌으면 5번 남는다', () => {
    expect(repicksLeft(null, day1)).toBe(5);
    expect(repicksLeft('x{', day1)).toBe(5);
  });
  it('찾을 때마다 줄고 0 아래로 가지 않는다', () => {
    let raw: string | null = null;
    for (const left of [4, 3, 2, 1, 0, 0]) {
      raw = spendRepick(raw, day1);
      expect(repicksLeft(raw, day1)).toBe(left);
    }
  });
  it('한국 시간 자정이 지나면 다시 5번이다', () => {
    const raw = spendRepick(spendRepick(null, day1), day1);
    expect(repicksLeft(raw, new Date('2026-11-11T14:59:00Z'))).toBe(3);
    expect(repicksLeft(raw, new Date('2026-11-11T15:00:00Z'))).toBe(5);
  });
});

describe('rankStakes', () => {
  it('서버가 쓰는 건 쪽 RP 식과 같다', () => {
    const s = rankStakes({ rating: 1150, division: 2 }, 1200, RULES);
    expect(s.win).toBe(rankPoints(1150, 1200, 1, 2));
    expect(s.draw).toBe(rankPoints(1150, 1200, 0.5, 2));
    expect(s.loss).toBe(rankPoints(1150, 1200, 0, 2));
    expect(s.promote).toBeNull();
    expect(s.relegate).toBeNull();
  });
  it('이기면 경계를 넘을 때 승격을 알린다', () => {
    expect(rankStakes({ rating: 1195, division: 2 }, 1195, RULES).promote).not.toBeNull();
  });
  it('강등 보호(guard)까지 넘어 떨어질 때만 강등을 알린다', () => {
    expect(rankStakes({ rating: 1100, division: 2 }, 1100, RULES).relegate).toBeNull();
    expect(rankStakes({ rating: 1072, division: 2 }, 1072, RULES).relegate).not.toBeNull();
  });
  it('디비전을 모르는 옛 응답도 그릴 수 있다', () => {
    expect(rankStakes({ rating: 900 }, 900, RULES).win).toBeGreaterThan(0);
  });
});
