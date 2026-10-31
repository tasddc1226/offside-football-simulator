import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addGoal, kstDay, loadGoals, msToKstMidnight } from './goals.js';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
});

// 2026-10-31 23:30 KST = 14:30 UTC
const late = Date.UTC(2026, 9, 31, 14, 30);

describe('오늘의 득점', () => {
  beforeEach(() => store.clear());

  it('한국 시각으로 날짜를 나눈다', () => {
    expect(kstDay(late)).toBe('2026-10-31');
    expect(kstDay(late + 30 * 60_000)).toBe('2026-11-01');
    expect(msToKstMidnight(late)).toBe(30 * 60_000);
  });

  it('골을 더하고 많이 넣은 순서로 정렬해 저장한다', () => {
    let rows = addGoal([], 'a', 'A', late);
    rows = addGoal(rows, 'b', 'B', late);
    rows = addGoal(rows, 'b', 'B2', late);
    expect(rows).toEqual([
      { id: 'b', name: 'B2', n: 2 },
      { id: 'a', name: 'A', n: 1 },
    ]);
    expect(loadGoals(late)).toEqual(rows);
  });

  it('날짜가 바뀌면 비어 있고, 깨진 저장값은 무시한다', () => {
    addGoal([], 'a', 'A', late);
    expect(loadGoals(late + 3_600_000)).toEqual([]);
    store.set('offside_lounge_goals_v1', '{');
    expect(loadGoals(late)).toEqual([]);
  });
});
