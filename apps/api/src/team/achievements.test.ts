import { describe, expect, it } from 'vitest';
import {
  clubAchievements,
  type AchievementCareer,
  type AchievementTeamSlot,
} from './achievements.js';

const career = (over: Partial<AchievementCareer> = {}): AchievementCareer => ({
  pos: 'FW',
  dpos: null,
  caps: 0,
  ballon: 0,
  trophies: 0,
  awards: 0,
  apps: 0,
  goals: 0,
  assists: 0,
  legendScore: 0,
  retiredNumber: false,
  seasons: [],
  ...over,
});
const slot = (over: Partial<AchievementTeamSlot> = {}): AchievementTeamSlot => ({
  careerId: 'c',
  fit: 1,
  lastClubId: 'pl-0',
  caps: 3,
  retiredNumber: true,
  ...over,
});
const item = (groups: ReturnType<typeof clubAchievements>, id: string) =>
  groups.flatMap((g) => g.items).find((i) => i.id === id);

describe('구단 시즌 업적', () => {
  it('선수가 없으면 모두 미달성이고, 팀을 넘기지 않으면 팀 업적이 없다', () => {
    const g = clubAchievements({ careers: [], team: null, teamWins: 0, detail: true });
    expect(g.map((x) => x.id)).toEqual([
      'first',
      'records',
      'collection',
      'locked-3',
      'locked-4',
      'locked-5',
    ]);
    expect(g.filter((x) => x.locked).every((x) => x.items.length === 0)).toBe(true);
    expect(g.flatMap((x) => x.items).every((i) => !i.done)).toBe(true);
  });

  it('첫 업적·모으기는 시즌 기록의 리그·영예 이름으로 판정한다', () => {
    const g = clubAchievements({
      careers: [
        career({
          pos: 'MF',
          dpos: 'AM',
          ballon: 1,
          retiredNumber: true,
          seasons: [
            { league: '프리미어리그', honors: ['프리미어리그 우승', 'PFA 올해의 선수'] },
            { league: '라리가', honors: ['FIFA 월드컵 우승', '피치치 트로피'] },
          ],
        }),
        career({ pos: 'GK', dpos: 'GK' }),
      ],
      team: null,
      teamWins: 0,
      detail: true,
    });
    expect(item(g, 'retire-MF')?.done).toBe(true);
    expect(item(g, 'retire-GK')?.done).toBe(true);
    expect(item(g, 'retire-FW')?.done).toBe(false);
    for (const id of ['national-win', 'europe', 'retired-number', 'poty', 'ballon'])
      expect(item(g, id)?.done, id).toBe(true);
    expect(item(g, 'all-dpos')).toMatchObject({ cur: 2, max: 8, done: false });
    expect(item(g, 'all-league-win')).toMatchObject({ cur: 1, max: 11 });
    expect(item(g, 'all-top-scorer')).toMatchObject({ cur: 1 });
    expect(item(g, 'big5')).toMatchObject({ cur: 2, max: 5 });
    expect(item(g, 'all-dpos-ballon')).toMatchObject({ cur: 1, max: 8 });
  });

  it('프리시즌에는 세부 포지션 업적을 보이지 않는다', () => {
    const g = clubAchievements({ careers: [], team: null, teamWins: 0, detail: false });
    expect(item(g, 'all-dpos')).toBeUndefined();
    expect(item(g, 'all-dpos-ballon')).toBeUndefined();
  });

  it('단계 업적은 선수 기록의 합으로 단계와 다음 목표를 낸다', () => {
    const g = clubAchievements({
      careers: [career({ goals: 250 }), career({ goals: 120 })],
      team: null,
      teamWins: 0,
      detail: true,
    });
    expect(item(g, 'goals')).toMatchObject({ cur: 370, level: 2, next: 1000, done: true });
    expect(item(g, 'assists')).toMatchObject({ cur: 0, level: 0, next: 100, done: false });
  });

  it('팀 업적: 빈 팀은 채우기 미달성, 11명이 모두 조건을 채워야 달성', () => {
    const empty = clubAchievements({ careers: [], team: [], teamWins: 0, detail: true });
    expect(item(empty, 'team-full')?.done).toBe(false);
    expect(item(empty, 'team-one')?.done).toBe(false);

    const full = Array.from({ length: 11 }, () => slot());
    const g = clubAchievements({ careers: [], team: full, teamWins: 12, detail: true });
    for (const id of ['team-one', 'team-full', 'team-fit', 'team-club', 'team-caps', 'team-rn'])
      expect(item(g, id)?.done, id).toBe(true);
    expect(item(g, 'team-wins')).toMatchObject({ level: 1, next: 30 });
    expect(item(g, 'team-win')?.done).toBe(true);

    const mixed = [...full.slice(0, 10), slot({ lastClubId: 'll-0', fit: 0.9 })];
    const m = clubAchievements({ careers: [], team: mixed, teamWins: 0, detail: true });
    expect(item(m, 'team-club')?.done).toBe(false);
    expect(item(m, 'team-fit')?.done).toBe(false);
    expect(item(m, 'team-caps')?.done).toBe(true);
  });
});
