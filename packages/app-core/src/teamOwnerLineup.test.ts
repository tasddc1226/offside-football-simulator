import { describe, expect, it } from 'vitest';
import { FORMATIONS, shapeLayout } from '@offside/contracts/owner-team';
import type { ClubAchievement, OwnerTeam, TeamMatch, TeamPlayer } from './api/team.js';
import { cardSeasonBadge } from './format.js';
import {
  achDone,
  achState,
  assignSlot,
  attrLine,
  autoFillSlots,
  pastSalaryIn,
  salaryBar,
  salaryBlocks,
  salaryFullText,
  matchHintOf,
  outcomeOf,
  teamEditableIn,
  playHintOf,
} from './teamOwner.js';
import {
  loadPreset,
  nextPresetName,
  presetOf,
  presetSummary,
  presetsFull,
  removePreset,
  renamePreset,
  replacePreset,
  setCupPreset,
  cupPresetOf,
} from './teamPresets.js';

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
    const next = autoFillSlots(slots433, [], 0);
    expect(next).toHaveLength(11);
    expect(next.every((s) => s === null)).toBe(true);
  });
  it('자리마다 가장 잘 맞는 선수를 넣고 한 선수를 두 번 쓰지 않는다', () => {
    const players = [
      player('gk', { pos: 'GK', dpos: 'GK', peak: 80 }),
      player('st', { pos: 'FW', dpos: 'ST', peak: 85 }),
      player('cb', { pos: 'DF', dpos: 'CB', peak: 75 }),
    ];
    const next = autoFillSlots(slots433, players, 0);
    expect(next[slots433.indexOf('GK')]).toBe('gk');
    expect(next[slots433.indexOf('ST')]).toBe('st');
    expect(next[slots433.indexOf('CB')]).toBe('cb');
    const used = next.filter((s) => s !== null);
    expect(new Set(used).size).toBe(used.length);
  });
  it('그 자리 실력이 유스 선수(50) 이하면 채우지 않는다', () => {
    const next = autoFillSlots(slots433, [player('weak', { pos: 'GK', peak: 50 })], 0);
    expect(next.every((s) => s === null)).toBe(true);
    // 골키퍼가 아닌 필드 자리에서는 0.3 적합도라 80 → 24 로 떨어져 GK 자리만 채운다.
    const gkOnly = autoFillSlots(slots433, [player('gk', { pos: 'GK', peak: 80 })], 0);
    expect(gkOnly.filter((s) => s !== null)).toEqual(['gk']);
    expect(gkOnly[slots433.indexOf('GK')]).toBe('gk');
  });
  it('선수가 11명보다 적으면 남는 자리는 null 로 둔다', () => {
    const next = autoFillSlots(
      slots433,
      [player('st', { peak: 80 }), player('st2', { peak: 79 })],
      0,
    );
    expect(next.filter((s) => s !== null)).toHaveLength(2);
  });
  it('실력이 같으면 FILL_ORDER 가 앞선 자리(ST)를 먼저 채운다', () => {
    // 같은 세부 포지션이 없는 공격수 한 명 — ST(0.95)와 W(0.95)가 같아 ST 자리를 차지한다.
    const next = autoFillSlots(['W', 'ST'], [player('fw', { peak: 80 })], 0);
    expect(next[1]).toBe('fw');
    expect(next[0]).toBeNull();
  });

  it('T-11-376 지난 시즌 선수는 급여 합이 예산(60) 안에서만 채우고, 넘는 배치를 알려 준다', () => {
    // OVR 96 이상은 급여 20 — 예산 60이면 예전 와일드카드처럼 3명까지 든다.
    const old = [1, 2, 3, 4].map((i) => player(`old${i}`, { peak: 96, season: 0 }));
    const fresh = player('new', { peak: 75, season: 1 });
    const next = autoFillSlots(slots433, [...old, fresh], 1, 60);
    const byId = new Map([...old, fresh].map((p) => [p.careerId, p]));
    expect(pastSalaryIn(next, byId, 1)).toBe(60);
    expect(next.filter((id) => id?.startsWith('old'))).toHaveLength(3);
    expect(next).toContain('new');
    const free = next.indexOf(null);
    const over = assignSlot(next, free, 'old4');
    expect(salaryBlocks(next, over, byId, 1, 60)).toBe(true);
    expect(salaryFullText(over, 'old4', byId, 1, 60)).toBe(
      '이 선수 급여(20)가 남은 예산(0)보다 커요. 지난 시즌 선수를 빼거나 이번 시즌 선수로 채워 주세요.',
    );
    // 이미 든 선수끼리 자리를 바꾸는 건 괜찮다. 이번 시즌 선수는 급여가 없다.
    expect(salaryBlocks(next, assignSlot(next, next.indexOf('old1'), 'old2'), byId, 1, 60)).toBe(
      false,
    );
    expect(salaryBar(next, byId, 1, 60)).toMatchObject({
      sum: 60,
      left: 0,
      state: 'full',
      label: '지난 시즌 선수 급여 60 / 60',
    });
    expect(salaryBar(next, byId, 0, 60)).toBeNull();
    expect(cardSeasonBadge(0)).toBe('PRE');
    expect(cardSeasonBadge(2)).toBe('S2');
  });

  it('T-11-376 예산을 내린 뒤 넘은 선발도 급여를 줄이는 바꾸기는 막지 않는다', () => {
    const a = player('a', { peak: 96, season: 0 });
    const b = player('b', { peak: 90, season: 0 });
    const byId = new Map([a, b].map((p) => [p.careerId, p]));
    const slots = ['a', null, null, null, null, null, null, null, null, null, null];
    expect(salaryBar(slots, byId, 1, 15)?.state).toBe('over');
    expect(salaryBlocks(slots, assignSlot(slots, 0, 'b'), byId, 1, 15)).toBe(false);
    expect(salaryBlocks(slots, assignSlot(slots, 1, 'b'), byId, 1, 15)).toBe(true);
  });

  it('T-11-376 OVR 85~87(급여 6) 지난 시즌 선수는 예산 60이면 10명까지 든다', () => {
    const old = Array.from({ length: 11 }, (_, i) =>
      player(`m${i}`, {
        pos: i === 0 ? 'GK' : i < 5 ? 'DF' : i < 8 ? 'MF' : 'FW',
        peak: 85,
        season: 0,
      }),
    );
    const byId = new Map(old.map((p) => [p.careerId, p]));
    const next = autoFillSlots(slots433, old, 1, 60);
    expect(next.filter((x) => x !== null)).toHaveLength(10);
    expect(pastSalaryIn(next, byId, 1)).toBe(60);
    // T-11-450 기본 예산 80이면 11명(급여 66) 모두 든다.
    expect(autoFillSlots(slots433, old, 1).filter((x) => x !== null)).toHaveLength(11);
  });

  it('T-11-376 예산이 넉넉하면 제한 없을 때와 같은 선발, 빠듯하면 급여 대비 센 조합을 고른다', () => {
    const players = [
      player('gk', { pos: 'GK', peak: 88, season: 0 }),
      player('cb', { pos: 'DF', dpos: 'CB', peak: 84, season: 1 }),
      player('st', { pos: 'FW', dpos: 'ST', peak: 92, season: 0 }),
      player('cm', { pos: 'MF', dpos: 'CM', peak: 80, season: 0 }),
    ];
    expect(autoFillSlots(slots433, players, 1)).toEqual(autoFillSlots(slots433, players, 1, 1000));
    // 예산 20: OVR 96 한 명(20)보다 OVR 90 두 명(10 + 10)이 합이 더 세다.
    const tight = [
      player('star', { pos: 'FW', dpos: 'ST', peak: 96, season: 0 }),
      player('fw90', { pos: 'FW', dpos: 'ST', peak: 90, season: 0 }),
      player('mf90', { pos: 'MF', dpos: 'CM', peak: 90, season: 0 }),
    ];
    const next = autoFillSlots(['ST', 'CM'], tight, 1, 20);
    expect(next).toEqual(['fw90', 'mf90', ...Array(9).fill(null)]);
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
});

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const slots = [A, null, null, null, null, null, null, null, null, B, null];

describe('T-11-217 팀 프리셋', () => {
  it('불러오면 지금 없는 선수 자리는 비우고 그 수를 센다', () => {
    const p = presetOf(' 공격 ', '4-3-3', slots, shapeLayout('4-2-3-1'));
    expect(p.name).toBe('공격');
    const r = loadPreset(p, new Set([A]));
    expect(r.slots[0]).toBe(A);
    expect(r.slots[9]).toBeNull();
    expect(r.missing).toBe(1);
    expect(presetSummary(p)).toEqual({ shape: '4-2-3-1', starters: 2 });
  });

  it('기본 이름은 겹치지 않고, 목록은 5개가 상한', () => {
    const label = ({ n }: { n: number }) => `프리셋 ${n}`;
    const one = presetOf('프리셋 2', '4-4-2', slots, null);
    expect(nextPresetName([one], label)).toBe('프리셋 3');
    const list = Array.from({ length: 5 }, (_, i) => presetOf(`p${i}`, '4-3-3', slots, null));
    expect(presetsFull(list)).toBe(true);
    expect(presetsFull(removePreset(list, 0))).toBe(false);
    expect(renamePreset(list, 1, ' 새 이름 ')[1]!.name).toBe('새 이름');
  });

  it('T-11-570 컵 명단은 하나만, 덮어써도 컵 명단 표시가 남는다', () => {
    const list = Array.from({ length: 3 }, (_, i) => presetOf(`p${i}`, '4-3-3', slots, null));
    const one = setCupPreset(list, 1);
    expect(one.map((p) => !!p.cup)).toEqual([false, true, false]);
    expect(cupPresetOf(one)?.name).toBe('p1');
    const moved = setCupPreset(one, 2);
    expect(moved.map((p) => !!p.cup)).toEqual([false, false, true]);
    expect(cupPresetOf(setCupPreset(moved, null))).toBeNull();
    const over = replacePreset(moved, 2, presetOf('p2', '4-4-2', slots, null));
    expect(over[2]).toMatchObject({ formation: '4-4-2', cup: true });
    expect(replacePreset(moved, 0, presetOf('p0', '4-4-2', slots, null))[0]!.cup).toBeUndefined();
  });
});
