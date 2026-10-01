import { describe, expect, it } from 'vitest';
import type { ClubAchievementGroup } from './api/team.js';
import { achLockedRange, achNear, achOpenGroup, achTotal, matchHintOf } from './teamOwner.js';

const g = (
  id: string,
  items: ClubAchievementGroup['items'],
  locked = false,
): ClubAchievementGroup => ({
  id,
  stage: locked ? `${id}단계` : id,
  title: id,
  items,
  ...(locked ? { locked: true } : {}),
});
const groups: ClubAchievementGroup[] = [
  g('first', [
    { id: 'a', label: 'a', done: true },
    { id: 'b', label: 'b', done: false },
    { id: 'c', label: 'c', done: false, cur: 4, max: 8 },
  ]),
  g('records', [
    { id: 'goal', label: '골', done: true, cur: 402, level: 2, next: 1000 },
    { id: 'win', label: '우승', done: true, cur: 29, level: 3, next: null },
    { id: 'caps', label: 'A매치', done: false, cur: 80, level: 0, next: 100 },
  ]),
  g('3', [], true),
  g('4', [], true),
  g('5', [], true),
  g('team', [{ id: 't', label: 't', done: true }]),
];

describe('시즌 업적 요약', () => {
  it('열린 단계만 센다', () => {
    expect(achTotal(groups)).toEqual({ done: 4, total: 7 });
  });
  it('다음 목표에 가까운 순 — 최고 단계·숫자 없는 업적은 뺀다', () => {
    expect(achNear(groups).map((n) => n.item.id)).toEqual(['caps', 'c', 'goal']);
    expect(achNear(groups, 1)[0]).toMatchObject({ group: 'records', ratio: 0.8 });
  });
  it('잠긴 단계를 한 줄로 묶는다', () => {
    expect(achLockedRange(groups)).toBe('3–5단계');
    expect(achLockedRange([g('3', [], true)])).toBe('3단계');
    expect(achLockedRange(groups.filter((x) => !x.locked))).toBeNull();
  });
  it('처음 펼칠 단계는 다 채우지 못한 첫 단계', () => {
    expect(achOpenGroup(groups)).toBe('first');
    expect(achOpenGroup([groups[5]!])).toBeNull();
  });
});

describe('matchHintOf', () => {
  it('휴식기 · 지난 시즌은 경기할 수 없다', () => {
    expect(matchHintOf(null, false, 10, 1, null)).toMatch(/휴식기/);
    expect(matchHintOf(null, false, 10, 0, 1)).toMatch(/지난 시즌/);
    expect(matchHintOf(null, false, 10, 1, 1)).toMatch(/저장/);
  });
});
