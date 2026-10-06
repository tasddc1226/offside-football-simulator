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
  synergyRows,
  draftLines,
  matchHintOf,
  slotsSynergy,
  synergyChips,
  synergyEffectText,
  synergyFocus,
  synergyNote,
} from './teamOwner.js';
import { presetLayout } from '@offside/contracts/owner-team';

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
  it('장기근속과 원클럽맨의 미달성 안내는 서로 다른 조건이다', () => {
    expect(achState(it_({ id: 'long-service', done: false }))).toMatch(
      /누적 10시즌.*복귀.*상무 기간은 제외/,
    );
    expect(achState(it_({ id: 'one-club', done: false }))).toMatch(
      /총 프로 10시즌.*일반 구단.*상무는 구단 수에서 제외/,
    );
    expect(achState(it_({ id: 'long-service', done: true }))).toBe('달성 완료');
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
    // T-11-113 개막 뒤 프리시즌 팀은 친선전 전용이다. 그 밖의 지난 시즌은 보기만 한다.
    expect(matchHintOf(null, false, 10, 0, 1)).toMatch(/친선전에만/);
    expect(matchHintOf(null, false, 10, 1, 2)).toMatch(/지난 시즌/);
    expect(matchHintOf(null, false, 10, 1, 1)).toMatch(/저장/);
  });
});

describe('T-11-105 편성 화면 시너지', () => {
  const base = {
    pos: 'FW',
    dpos: null,
    peak: 80,
    roles: null,
    attrs: null,
    number: 9,
    publicName: null,
    legendScore: null,
  } as const;
  const st = { ...base, careerId: 'st', type: 'target', foot: '오른발' };
  const w = { ...base, careerId: 'w', type: 'winger', foot: '오른발', raised: true };
  const layout = presetLayout('4-3-3');
  const slots: (string | null)[] = Array(11).fill(null);
  slots[9] = 'st';
  slots[8] = 'w';
  const s = slotsSynergy(layout, slots, new Map([st, w].map((p) => [p.careerId, p])));

  it('편성 중인 선발로 서버와 같은 시너지를 센다(빈 자리는 유스)', () => {
    expect(s.active.map((a) => a.id)).toEqual(['cross', 'foot']);
    expect(synergyChips(s).map((c) => [c.name, c.effect])).toEqual([
      ['크로스 공식', '공격 +2'],
      ['주발 맞춤 1명', '자리 실력 +1'],
    ]);
  });
  it('고른 칩: 듀오 선은 굵게, 선수 자리는 테두리', () => {
    expect(synergyFocus(s, 'cross')).toEqual({
      links: [{ members: [8, 9], on: true }],
      members: [8, 9],
      applied: [8, 9],
      caption: '크로스 공식 선수 보기 · 2개 모두 적용 중',
    });
    expect(synergyFocus(s, 'foot')).toMatchObject({
      links: [{ members: [8, 9], on: false }],
      members: [8],
    });
    // 칩을 고르지 않아도 켜진 시너지의 선수는 모두 표시한다.
    expect(synergyFocus(s, null)).toMatchObject({
      members: null,
      applied: [8, 9],
      caption: '시너지 2개 모두 적용 중',
    });
    expect(synergyChips(s).map((c) => c.applied)).toEqual([true, true]);
  });
  it('줄 힘은 시즌 1부터 시너지를 더한다(프리시즌 제외)', () => {
    const codes = layout.map((p) => p.slot);
    const r = Array(11).fill(70);
    expect(draftLines(codes, r, s, 0).atk).toBeLessThan(draftLines(codes, r, s, 1).atk);
  });
  it('효과 표기 · 반영 시즌 안내 · 시너지 표', () => {
    expect(synergyEffectText({ atk: 1, mid: 0.5 })).toBe('공격 +1 · 중원 +0.5');
    expect(synergyEffectText({}, 'duo')).toBe('상한에 걸려 효과 없음');
    expect(synergyEffectText({}, 'badge')).toBe('경기 효과 없음');
    expect(synergyNote(0)).toBe('프리시즌 경기에는 반영되지 않았어요');
    expect(synergyNote(1)).toBe('켜진 시너지는 모두 경기에 반영돼요');
    // 규칙 전부를 적용 중 → 미적용 순으로. 켜진 것은 실제 효과, 미적용은 규칙 효과.
    const rows = synergyRows(s);
    expect(rows.slice(0, 2).map((r) => [r.id, r.state, r.effect])).toEqual([
      ['cross', 'applied', '공격 +2'],
      ['foot', 'applied', '자리 실력 +1'],
    ]);
    expect(rows.slice(2).every((r) => r.state === 'off')).toBe(true);
    expect(rows.find((r) => r.id === 'national')).toMatchObject({
      badge: true,
      effect: '배지만(경기 효과 없음)',
    });
  });
});
