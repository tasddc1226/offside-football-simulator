import { describe, expect, it } from 'vitest';
import { HOME_BLOCKS, NO_HOME_TODO, homeOrder, homeTodoOf } from './homeOrder';

const att = (checkedIn: boolean) => ({
  kind: 'owner' as const,
  att: { today: '2026-10-21', checkedIn, stamps: 3, streak: 3, bestStreak: 3 },
});

describe('T-11-435 홈 블록 순서', () => {
  it('받을 게 없으면 원래 순서(선물 · 출석은 컵 · 리그 배너 아래)', () => {
    const order = homeOrder(NO_HOME_TODO);
    expect(order).toEqual([...HOME_BLOCKS]);
    expect(order.indexOf('gift')).toBeGreaterThan(order.indexOf('league'));
    expect(order.indexOf('attendance')).toBeGreaterThan(order.indexOf('seasonGauge'));
  });

  it('받을 선물이 있으면 선물만 히어로 바로 아래로 올린다', () => {
    const order = homeOrder({ gift: true, attendance: false });
    expect(order[0]).toBe('gift');
    expect(order.indexOf('attendance')).toBeGreaterThan(order.indexOf('league'));
  });

  it('선물과 출석이 모두 있으면 선물 · 출석 순으로 맨 앞', () => {
    const order = homeOrder({ gift: true, attendance: true });
    expect(order.slice(0, 2)).toEqual(['gift', 'attendance']);
    expect(order.slice(2)).toEqual(HOME_BLOCKS.filter((b) => b !== 'gift' && b !== 'attendance'));
  });

  it('출석만 남았으면 출석이 맨 앞이고 블록이 빠지거나 겹치지 않는다', () => {
    const order = homeOrder({ gift: false, attendance: true });
    expect(order[0]).toBe('attendance');
    expect(new Set(order).size).toBe(HOME_BLOCKS.length);
    expect([...order].sort()).toEqual([...HOME_BLOCKS].sort());
  });

  it('받을 것: 선물이 있으면, 출석은 오늘 출석 전인 구단주만', () => {
    expect(homeTodoOf({ id: 'g', boost: 1, scout: 1 }, null)).toEqual({
      gift: true,
      attendance: false,
    });
    expect(homeTodoOf(null, att(false))).toEqual({ gift: false, attendance: true });
    expect(homeTodoOf(null, att(true))).toEqual(NO_HOME_TODO);
    // 비로그인 기기는 출석 보상을 받을 수 없어 원래 자리에 둔다.
    expect(homeTodoOf(null, { kind: 'guest' })).toEqual(NO_HOME_TODO);
  });
});
