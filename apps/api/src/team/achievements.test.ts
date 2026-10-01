import { describe, expect, it } from 'vitest';
import {
  clubAchievements,
  type AchievementCareer,
  type AchievementSeason,
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
  nation: null,
  retireAge: 35,
  seasons: [],
  ...over,
});
const season = (over: Partial<AchievementSeason> = {}): AchievementSeason => ({
  league: '프리미어리그',
  honors: [],
  club: 'pl-0',
  goals: 0,
  cs: null,
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
      'legend',
      'world',
      'immortal',
    ]);
    expect(g.some((x) => x.locked)).toBe(false);
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
            season({ honors: ['프리미어리그 우승', 'PFA 올해의 선수'] }),
            season({ league: '라리가', honors: ['FIFA 월드컵 우승', '피치치 트로피'] }),
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

  it('3단계: 한 선수의 위업 — 원클럽맨 · 한 시즌 기록 · 트레블', () => {
    const pro = (n: number, club: string) =>
      Array.from({ length: n }, () => season({ league: 'K리그1', club }));
    const g = clubAchievements({
      careers: [
        career({ seasons: [season({ league: '고교 리그', club: 'hs-0' }), ...pro(10, 'k1-0')] }),
        career({ caps: 150, goals: 500, retireAge: 40, ballon: 3 }),
        career({ pos: 'GK', seasons: [season({ cs: 20 })] }),
        career({ seasons: [season({ goals: 50 })] }),
      ],
      team: null,
      teamWins: 0,
      detail: true,
    });
    const legend = g.find((x) => x.id === 'legend')!;
    expect(legend.items.filter((i) => !i.done).map((i) => i.id)).toEqual(['treble']);
    // 9시즌이거나 두 구단을 거치면 원클럽맨이 아니다. 필드 선수의 무실점은 세지 않는다.
    const not = clubAchievements({
      careers: [
        career({ seasons: pro(9, 'k1-0') }),
        career({ seasons: [...pro(9, 'k1-0'), ...pro(2, 'k1-1')] }),
        career({ seasons: [season({ cs: 25 })] }),
      ],
      team: null,
      teamWins: 0,
      detail: true,
    });
    expect(item(not, 'one-club')?.done).toBe(false);
    expect(item(not, 'gk-cs-20')?.done).toBe(false);
  });

  it('트레블은 그 시즌 리그 · 대륙 대회 우승을 포함한 클럽 우승 3개(슈퍼컵 · 대표팀 제외)', () => {
    const t = (honors: string[]) =>
      item(
        clubAchievements({
          careers: [career({ seasons: [season({ honors })] })],
          team: null,
          teamWins: 0,
          detail: true,
        }),
        'treble',
      )?.done;
    expect(t(['프리미어리그 우승', 'FA컵 우승', 'UEFA 챔피언스리그 우승'])).toBe(true);
    expect(t(['프리미어리그 우승', 'FA 커뮤니티 실드 우승', 'UEFA 챔피언스리그 우승'])).toBe(false);
    expect(t(['프리미어리그 우승', 'FA컵 우승', 'EFL컵 우승'])).toBe(false);
    expect(t(['라리가 우승', 'FA컵 우승', 'UEFA 챔피언스리그 우승'])).toBe(false);
    expect(t(['프리미어리그 우승', 'FIFA 월드컵 우승', 'UEFA 챔피언스리그 우승'])).toBe(false);
  });

  it('4단계: 세계 무대 우승과 국적 수, 5단계: 구단 전체 합', () => {
    const g = clubAchievements({
      careers: [
        career({
          nation: 'KR',
          ballon: 10,
          retiredNumber: true,
          seasons: [
            season({ honors: ['FIFA 월드컵 우승', 'UEFA 챔피언스리그 우승', '유러피언 골든슈'] }),
            season({ honors: ['FIFA 월드컵 우승', 'AFC 아시안컵 우승', '올림픽 금메달'] }),
          ],
        }),
        career({ pos: 'GK', nation: 'JP', ballon: 1, retiredNumber: true }),
        career({ nation: 'KR', goals: 800, legendScore: 3000 }),
      ],
      team: null,
      teamWins: 0,
      detail: true,
    });
    for (const id of [
      'world-cup',
      'conf-cup',
      'olympic',
      'ucl',
      'golden-shoe',
      'ballon-10',
      'goals-800',
      'legend-3000',
    ])
      expect(item(g, id)?.done, id).toBe(true);
    expect(item(g, 'club-wc')?.done).toBe(false);
    expect(item(g, 'all-continental')).toMatchObject({ cur: 1, max: 3 });
    expect(item(g, 'nations')).toMatchObject({ cur: 2, max: 5 });
    expect(item(g, 'rn-11')).toMatchObject({ cur: 2, max: 11 });
    expect(item(g, 'ballon-30')).toMatchObject({ cur: 11, max: 30 });
    expect(item(g, 'ballon-pos')).toMatchObject({ cur: 2, max: 4 });
    expect(item(g, 'world-cup-3')).toMatchObject({ cur: 2, max: 3 });
  });
});
