import { describe, expect, it } from 'vitest';
import { FORMATIONS } from '@offside/contracts/owner-team';
import type { ClubAchievement, OwnerTeam, TeamMatch, TeamPlayer } from './api/team.js';
import {
  achDone,
  achState,
  assignSlot,
  attrLine,
  autoFillSlots,
  matchHintOf,
  outcomeOf,
  teamEditableIn,
  pct,
  pickCandidates,
  playHintOf,
} from './teamOwner.js';

const player = (careerId: string, over: Partial<TeamPlayer> = {}): TeamPlayer => ({
  careerId,
  pos: 'FW',
  dpos: null,
  peak: 70,
  roles: null,
  attrs: null,
  number: null,
  publicName: null,
  legendScore: null,
  ...over,
});
const slots433 = FORMATIONS['4-3-3'];

describe('assignSlot', () => {
  const slots = ['a', 'b', null];
  it('빈 자리에 새 선수를 넣고 원본은 건드리지 않는다', () => {
    const next = assignSlot(slots, 2, 'c');
    expect(next).toEqual(['a', 'b', 'c']);
    expect(slots).toEqual(['a', 'b', null]);
  });
  it('이미 편성된 선수를 고르면 두 자리를 맞바꾼다', () => {
    expect(assignSlot(slots, 1, 'a')).toEqual(['b', 'a', null]);
  });
  it('이미 편성된 선수를 빈 자리로 옮기면 원래 자리가 빈다', () => {
    expect(assignSlot(slots, 2, 'a')).toEqual([null, 'b', 'a']);
  });
  it('null 을 넘기면 그 자리를 비운다', () => {
    expect(assignSlot(slots, 0, null)).toEqual([null, 'b', null]);
  });
  it('같은 자리에 같은 선수를 다시 넣어도 그대로다', () => {
    expect(assignSlot(slots, 0, 'a')).toEqual(slots);
  });
});

describe('autoFillSlots', () => {
  it('선수가 없으면 11자리 모두 비운다', () => {
    const next = autoFillSlots(slots433, []);
    expect(next).toHaveLength(11);
    expect(next.every((s) => s === null)).toBe(true);
  });
  it('자리마다 가장 잘 맞는 선수를 넣고 한 선수를 두 번 쓰지 않는다', () => {
    const players = [
      player('gk', { pos: 'GK', dpos: 'GK', peak: 80 }),
      player('st', { pos: 'FW', dpos: 'ST', peak: 85 }),
      player('cb', { pos: 'DF', dpos: 'CB', peak: 75 }),
    ];
    const next = autoFillSlots(slots433, players);
    expect(next[slots433.indexOf('GK')]).toBe('gk');
    expect(next[slots433.indexOf('ST')]).toBe('st');
    expect(next[slots433.indexOf('CB')]).toBe('cb');
    const used = next.filter((s) => s !== null);
    expect(new Set(used).size).toBe(used.length);
  });
  it('그 자리 실력이 유스 선수(50) 이하면 채우지 않는다', () => {
    const next = autoFillSlots(slots433, [player('weak', { pos: 'GK', peak: 50 })]);
    expect(next.every((s) => s === null)).toBe(true);
    // 골키퍼가 아닌 필드 자리에서는 0.3 적합도라 80 → 24 로 떨어져 GK 자리만 채운다.
    const gkOnly = autoFillSlots(slots433, [player('gk', { pos: 'GK', peak: 80 })]);
    expect(gkOnly.filter((s) => s !== null)).toEqual(['gk']);
    expect(gkOnly[slots433.indexOf('GK')]).toBe('gk');
  });
  it('선수가 11명보다 적으면 남는 자리는 null 로 둔다', () => {
    const next = autoFillSlots(slots433, [player('st', { peak: 80 }), player('st2', { peak: 79 })]);
    expect(next.filter((s) => s !== null)).toHaveLength(2);
  });
  it('실력이 같으면 FILL_ORDER 가 앞선 자리(ST)를 먼저 채운다', () => {
    // 같은 세부 포지션이 없는 공격수 한 명 — ST(0.95)와 W(0.95)가 같아 ST 자리를 차지한다.
    const next = autoFillSlots(['W', 'ST'], [player('fw', { peak: 80 })]);
    expect(next[1]).toBe('fw');
    expect(next[0]).toBeNull();
  });
});

describe('pickCandidates', () => {
  const players = [
    player('a', { peak: 70, legendScore: 100 }),
    player('b', { peak: 80, legendScore: null }),
    player('c', { peak: 80, legendScore: 300 }),
  ];
  const ids = (sort: Parameters<typeof pickCandidates>[4]) =>
    pickCandidates(slots433, slots433.indexOf('ST'), players, [], sort).map((c) => c.p.careerId);

  it('자리 실력 순 — 같으면 최고 OVR 순(안정 정렬)', () => {
    expect(ids('fit')).toEqual(['b', 'c', 'a']);
  });
  it('최고 OVR 순 — 같으면 자리 실력 순', () => {
    expect(ids('peak')).toEqual(['b', 'c', 'a']);
  });
  it('레전드 점수 순 — 점수가 없으면 0 으로 센다', () => {
    expect(ids('score')).toEqual(['c', 'a', 'b']);
  });
  it('이미 편성된 자리(at)와 없을 때(-1)를 알려 준다', () => {
    const slots = Array<string | null>(11).fill(null);
    slots[3] = 'a';
    const list = pickCandidates(slots433, 9, players, slots, 'fit');
    expect(list.find((c) => c.p.careerId === 'a')!.at).toBe(3);
    expect(list.find((c) => c.p.careerId === 'b')!.at).toBe(-1);
  });
  it('자리 실력과 적합도를 그 자리 기준으로 계산한다', () => {
    const gk = pickCandidates(slots433, 0, [player('f', { peak: 80 })], [], 'fit')[0]!;
    expect(gk).toMatchObject({ rating: 24, fit: 0.3 });
  });
  it('선수가 없으면 빈 목록이다', () => {
    expect(pickCandidates(slots433, 0, [], [], 'fit')).toEqual([]);
  });
});

describe('attrLine', () => {
  const attrs = { pac: 80, sho: 70, pas: 60, dri: 75, def: 50, phy: 65 };
  it('능력치가 없으면 null', () => {
    expect(attrLine(player('a'))).toBeNull();
  });
  it('필드 선수는 필드 약어로 한 줄', () => {
    expect(attrLine(player('a', { attrs }))).toBe(
      'PAC 80 · SHO 70 · PAS 60 · DRI 75 · DEF 50 · PHY 65',
    );
  });
  it('골키퍼는 골키퍼 능력치 이름을 쓴다', () => {
    expect(attrLine(player('g', { pos: 'GK', attrs }))).toBe(
      'REF 80 · SPD 70 · KIC 60 · POS 75 · DIV 50 · HAN 65',
    );
  });
});

describe('playHintOf', () => {
  const filled = (n: number) =>
    ({
      slots: Array.from({ length: 11 }, (_, i) => ({ careerId: i < n ? `c${i}` : null })),
    }) as unknown as OwnerTeam;
  it('팀이 없으면 저장 안내', () => {
    expect(playHintOf(null, false, 10)).toMatch(/팀을 저장/);
  });
  it('저장하지 않은 편성이면 저장 안내 — 팀 없음보다 뒤', () => {
    expect(playHintOf(filled(3), true, 10)).toMatch(/바꾼 편성/);
  });
  it('선수가 한 명도 없으면 은퇴 선수 안내', () => {
    expect(playHintOf(filled(0), false, 10)).toMatch(/은퇴 선수/);
  });
  it('오늘 경기를 다 치렀으면 자정 안내', () => {
    expect(playHintOf(filled(1), false, 0)).toMatch(/자정/);
  });
  it('할 수 있으면 null', () => {
    expect(playHintOf(filled(1), false, 1)).toBeNull();
  });
});

describe('matchHintOf 우선순위', () => {
  it('휴식기가 지난 시즌 판정보다 앞선다', () => {
    expect(matchHintOf(null, false, 10, 0, null)).toMatch(/휴식기/);
  });
  it('지금 시즌이면 playHintOf 로 넘긴다', () => {
    expect(matchHintOf(null, false, 10, 2, 2)).toMatch(/팀을 저장/);
  });
  it('T-11-113 개막 뒤 프리시즌 팀은 친선전 전용으로 고칠 수 있다', () => {
    expect(matchHintOf(null, false, 10, 0, 1)).toMatch(/친선전에만/);
    expect(teamEditableIn(0, 1)).toBe(true);
    expect(teamEditableIn(0, 0)).toBe(true);
    expect(teamEditableIn(1, 2)).toBe(false);
    expect(teamEditableIn(2, 2)).toBe(true);
  });
});

describe('업적 한 줄 표시', () => {
  const ach = (over: Partial<ClubAchievement>): ClubAchievement => ({
    id: 'x',
    label: 'x',
    done: false,
    points: 0,
    worth: 0,
    ...over,
  });
  it('달성 수를 센다', () => {
    expect(achDone([ach({ done: true }), ach({}), ach({ done: true })])).toBe(2);
    expect(achDone([])).toBe(0);
  });
  it('단계 업적은 단계·현재값·다음 목표를 보인다', () => {
    expect(achState(ach({ level: 2, cur: 1200, unit: '골', next: 5000 }))).toBe(
      '2단계 · 1,200골 · NEXT 5,000',
    );
  });
  it('최고 단계는 NEXT 대신 안내를 보인다', () => {
    expect(achState(ach({ level: 3, cur: 30, next: null }))).toBe('3단계 · 30 · 최고 단계');
  });
  it('모으기 업적은 현재 / 목표, 그 밖은 달성 여부', () => {
    expect(achState(ach({ max: 8, cur: 4 }))).toBe('4 / 8');
    expect(achState(ach({ max: 8 }))).toBe('0 / 8');
    expect(achState(ach({ done: true }))).toBe('달성 완료');
    expect(achState(ach({}))).toBe('미달성');
  });
});

describe('경기 결과', () => {
  const match = (mine: 'home' | 'away', home: number, away: number) =>
    ({ mine, home: { goals: home }, away: { goals: away } }) as unknown as TeamMatch;
  it('내 쪽(홈·원정) 기준으로 승무패를 가른다', () => {
    expect(outcomeOf(match('home', 2, 1))).toBe('승');
    expect(outcomeOf(match('away', 2, 1))).toBe('패');
    expect(outcomeOf(match('away', 0, 3))).toBe('승');
    expect(outcomeOf(match('home', 1, 1))).toBe('무');
  });
  it('pct 는 반올림한 퍼센트', () => {
    expect(pct(0)).toBe('0%');
    expect(pct(0.456)).toBe('46%');
    expect(pct(1)).toBe('100%');
  });
});
