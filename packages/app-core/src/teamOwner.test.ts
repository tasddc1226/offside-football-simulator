import { describe, expect, it } from 'vitest';
import type { ClubAchievementGroup } from './api/team.js';
import {
  achGradeView,
  achNear,
  achOpenGroup,
  achPoints,
  achRankText,
  achSections,
  achState,
  achTotal,
  matchHintOf,
} from './teamOwner.js';

type Item = ClubAchievementGroup['items'][number];
const it_ = (over: Partial<Item> & Pick<Item, 'id' | 'done'>): Item => ({
  label: over.id,
  points: 0,
  worth: 10,
  ...over,
});
const g = (
  id: string,
  items: Item[],
  category: ClubAchievementGroup['category'] = 'player',
  locked = false,
): ClubAchievementGroup => ({
  id,
  category,
  stage: id,
  title: id,
  items,
  ...(locked ? { locked: true } : {}),
});
const groups: ClubAchievementGroup[] = [
  g('first', [
    it_({ id: 'a', done: true, points: 10, worth: 0 }),
    it_({ id: 'b', done: false }),
    it_({ id: 'c', done: false, cur: 4, max: 8 }),
  ]),
  g('records', [
    it_({ id: 'goal', done: true, cur: 402, level: 2, next: 1000, points: 30, worth: 40 }),
    it_({ id: 'win', done: true, cur: 29, level: 3, next: null, points: 70, worth: 0 }),
    it_({ id: 'caps', done: false, cur: 80, level: 0, next: 100 }),
  ]),
  g('team', [it_({ id: 't', done: true, points: 20, worth: 0 })], 'team'),
  g('owner', [it_({ id: 'o', done: false, cur: 2, level: 0, next: 3 })], 'owner'),
  g('manager', [], 'manager', true),
];

describe('시즌 업적 요약', () => {
  it('열린 단계만 센다', () => {
    expect(achTotal(groups)).toEqual({ done: 4, total: 8 });
  });
  it('다음 목표에 가까운 순 — 최고 단계·숫자 없는 업적은 뺀다', () => {
    expect(achNear(groups).map((n) => n.item.id)).toEqual(['caps', 'o', 'c']);
    expect(achNear(groups, 1)[0]).toMatchObject({ group: 'records', ratio: 0.8 });
  });
  it('분류별로 묶고 점수를 센다 — 감독은 잠금', () => {
    const s = achSections(groups);
    expect(s.map((x) => [x.id, x.score, x.done, x.total, x.locked])).toEqual([
      ['player', 110, 3, 6, false],
      ['team', 20, 1, 1, false],
      ['owner', 0, 0, 1, false],
      ['manager', 0, 0, 0, true],
    ]);
    expect(s[0]!.name).toBe('선수 업적');
  });
  it('점수 표시와 등급 진행', () => {
    expect(achPoints(groups[0]!.items[0]!)).toBe('+10점');
    expect(achPoints(groups[0]!.items[1]!)).toBe('10점');
    expect(achGradeView(350)).toMatchObject({
      grade: { name: '브론즈' },
      next: { name: '실버' },
      toNext: 150,
      ratio: 0.5,
    });
    expect(achGradeView(9999)).toMatchObject({ next: null, toNext: 0, ratio: 1 });
    expect(achRankText(12, 297)).toBe('12위 · 297명 중');
    expect(achRankText(null, 3)).toMatch(/랭킹에 올라요/);
  });
  it('처음 펼칠 단계는 다 채우지 못한 첫 단계', () => {
    expect(achOpenGroup(groups)).toBe('first');
    expect(achOpenGroup([groups[2]!])).toBeNull();
  });
  it('제자리 업적은 못 이뤘을 때만 조건을 안내한다', () => {
    expect(achState(it_({ id: 'team-fit', done: false }))).toBe(
      '미달성 · 유스 선수 없이 11명 모두 적합도 1.00이어야 해요',
    );
    expect(achState(it_({ id: 'team-fit', done: true }))).toBe('달성 완료');
    expect(achState(it_({ id: 'team-caps', done: false }))).toBe('미달성');
  });
});

describe('matchHintOf', () => {
  it('휴식기 · 지난 시즌은 경기할 수 없다', () => {
    expect(matchHintOf(null, false, 10, 1, null)).toMatch(/휴식기/);
    expect(matchHintOf(null, false, 10, 0, 1)).toMatch(/지난 시즌/);
    expect(matchHintOf(null, false, 10, 1, 1)).toMatch(/저장/);
  });
});
