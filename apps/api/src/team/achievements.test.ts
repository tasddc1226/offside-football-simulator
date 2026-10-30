import { describe, expect, it } from 'vitest';
import {
  achievementScore,
  clubAchievements,
  teamKeptOf,
  type AchievementCareer,
  type AchievementOwner,
  type AchievementTeam,
  type AchievementSeason,
  type AchievementTeamSlot,
} from './achievements.js';
import { localizeAchievements } from './achievementsText.js';

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
const pro = (n: number, club: string) => Array.from({ length: n }, () => season({ club }));
/** 병역 시즌. 상무는 구단 id로, 현역은 mil 표시로 남는다. */
const sangmu = (n: number) => pro(n, 'sangmu').map((s) => ({ ...s, clubId: 'sangmu' }));
const army = (n: number) => pro(n, '현역 복무').map((s) => ({ ...s, league: '병역', mil: true }));
const slot = (over: Partial<AchievementTeamSlot> = {}): AchievementTeamSlot => ({
  careerId: 'c',
  fit: 1,
  lastClubId: 'pl-0',
  clubIds: ['pl-0'],
  caps: 3,
  retiredNumber: true,
  ...over,
});
const OWNER: AchievementOwner = { retireDays: 0, matchDays: 0, likesGiven: 0, nickname: false };
const teamOf = (
  slots: AchievementTeamSlot[],
  over: Partial<AchievementTeam> = {},
): AchievementTeam => ({
  slots,
  wins: 0,
  bestStreak: 0,
  bestMargin: 0,
  goalsFor: 0,
  rating: 1000,
  likes: 0,
  ...over,
});
const item = (groups: ReturnType<typeof clubAchievements>, id: string) =>
  groups.flatMap((g) => g.items).find((i) => i.id === id);

describe('구단 시즌 업적', () => {
  it('선수가 없으면 모두 미달성이고, 팀을 넘기지 않으면 팀 업적이 없다', () => {
    const g = clubAchievements({
      careers: [],
      team: null,
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(g.map((x) => x.id)).toEqual([
      'first',
      'records',
      'collection',
      'legend',
      'world',
      'immortal',
      'beyond',
      'owner',
      'manager',
    ]);
    expect(g.map((x) => x.category)).toEqual([
      ...Array<string>(7).fill('player'),
      'owner',
      'manager',
    ]);
    // T-11-310 감독 업적이 열렸다(잠금 없음).
    expect(g.filter((x) => x.locked).map((x) => x.id)).toEqual([]);
    expect(g.flatMap((x) => x.items).every((i) => !i.done && i.points === 0)).toBe(true);
    expect(achievementScore(g)).toEqual({ score: 0, done: 0 });
  });

  it('T-11-310 감독 업적은 그 시즌에 끝낸 감독과 감독 칸으로 판정한다', () => {
    const g = clubAchievements({
      careers: [],
      team: null,
      owner: OWNER,
      detail: true,
      retireAt: 41,
      managers: [
        {
          titles: 1,
          promotions: 0,
          grade: 'S',
          mastery: { '4-3-3': 'S', '4-4-2': 'B', '3-5-2': 'C' },
        },
        {
          titles: 0,
          promotions: 2,
          grade: 'B',
          mastery: { '4-3-3': 'A', '4-4-2': 'C', '3-5-2': 'C' },
        },
      ],
    });
    const done = g
      .find((x) => x.id === 'manager')!
      .items.filter((i) => i.done)
      .map((i) => i.id);
    expect(done).toEqual([
      'mgr-first',
      'mgr-count',
      'mgr-title',
      'mgr-promote',
      'mgr-mastery',
      'mgr-grade',
    ]);
    expect(g.find((x) => x.id === 'manager')!.items.find((i) => i.id === 'mgr-count')!.level).toBe(
      1,
    );
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
      owner: OWNER,
      detail: true,
      retireAt: 41,
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
    // T-11-180 모음 업적은 아직 못 모은 이름을 싣는다.
    expect(item(g, 'all-league-win')?.missing).toHaveLength(10);
    expect(item(g, 'all-league-win')?.missing).not.toContain('프리미어리그');
    expect(item(g, 'all-top-scorer')?.missing).not.toContain('피치치 트로피');
    expect(item(g, 'big5')?.missing).toEqual(['리그 1', '분데스리가', '세리에 A']);
    expect(item(g, 'all-dpos-ballon')).toMatchObject({ cur: 1, max: 8 });
  });

  it('프리시즌에는 세부 포지션 업적을 보이지 않는다', () => {
    const g = clubAchievements({
      careers: [],
      team: null,
      owner: OWNER,
      detail: false,
      retireAt: 41,
    });
    expect(item(g, 'all-dpos')).toBeUndefined();
    expect(item(g, 'all-dpos-ballon')).toBeUndefined();
  });

  it('단계 업적은 선수 기록의 합으로 단계와 다음 목표를 낸다', () => {
    const g = clubAchievements({
      careers: [career({ goals: 250 }), career({ goals: 120 })],
      team: null,
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(g, 'goals')).toMatchObject({ cur: 370, level: 2, next: 1000, done: true });
    expect(item(g, 'assists')).toMatchObject({ cur: 0, level: 0, next: 100, done: false });
  });

  it('팀 업적: 빈 팀은 채우기 미달성, 11명이 모두 조건을 채워야 달성', () => {
    const empty = clubAchievements({
      careers: [],
      team: teamOf([]),
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(empty, 'team-full')?.done).toBe(false);
    expect(item(empty, 'team-one')?.done).toBe(false);

    const full = Array.from({ length: 11 }, () => slot());
    const g = clubAchievements({
      careers: [],
      team: teamOf(full, { wins: 12 }),
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    for (const id of [
      'team-one',
      'team-full',
      'team-fit',
      'team-club',
      'team-mates',
      'team-caps',
      'team-rn',
    ])
      expect(item(g, id)?.done, id).toBe(true);
    expect(item(g, 'team-wins')).toMatchObject({ level: 1, next: 30 });
    expect(item(g, 'team-win')?.done).toBe(true);

    const mixed = [...full.slice(0, 10), slot({ lastClubId: 'll-0', fit: 0.9 })];
    const m = clubAchievements({
      careers: [],
      team: teamOf(mixed),
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(m, 'team-club')?.done).toBe(false);
    expect(item(m, 'team-fit')?.done).toBe(false);
    expect(item(m, 'team-caps')?.done).toBe(true);
  });

  it('T-11-237 윗단계·6단계 전설 너머: 손꼽히는 기록에만 닿는다', () => {
    const judge = (careers: AchievementCareer[]) =>
      clubAchievements({ careers, team: null, owner: OWNER, detail: true, retireAt: 44 });
    const win = (league: string) => season({ league, honors: [`${league} 우승`] });
    const star = career({
      goals: 1000,
      ballon: 15,
      legendScore: 4000,
      seasons: ['프리미어리그', '라리가', '세리에 A', '분데스리가', '리그 1'].map(win),
    });
    const g = judge([star]);
    for (const id of ['ballon-15', 'goals-1000', 'legend-4000', 'big5-one'])
      expect(item(g, id), id).toMatchObject({ done: true, points: 250 });
    expect(item(g, 'world-cup-5')).toMatchObject({ done: false, cur: 0, max: 5 });
    // 빅5 우승을 여러 선수가 나눠 가지면 한 선수 기록이 아니다.
    const split = judge([
      career({ seasons: [win('프리미어리그'), win('라리가')] }),
      career({ seasons: [win('세리에 A'), win('분데스리가'), win('리그 1')] }),
    ]);
    expect(item(split, 'big5-one')).toMatchObject({ done: false, cur: 3 });
    // 단계 업적 6단계는 320점.
    const goals = item(judge([career({ goals: 30000 })]), 'goals');
    expect(goals).toMatchObject({ level: 6, next: null, points: 10 + 20 + 40 + 80 + 160 + 320 });
    expect(item(judge([career({ goals: 10000 })]), 'goals')).toMatchObject({
      level: 5,
      next: 30000,
    });
  });

  it('T-11-237 드림팀: 11명 모두 발롱도르·같은 국적·OVR 95 이상, 컵 4강·우승', () => {
    const judge = (slots: AchievementTeamSlot[], cupBest: AchievementTeam['cupBest'] = null) =>
      clubAchievements({
        careers: [],
        team: { ...teamOf(slots), cupBest },
        owner: OWNER,
        detail: true,
        retireAt: 44,
      });
    const dream = Array.from({ length: 11 }, () => slot({ ballon: 1, nation: 'KR', peak: 95 }));
    const g = judge(dream, 'champion');
    for (const id of ['team-ballon', 'team-nation', 'team-ovr95', 'team-cup-sf', 'team-cup-win'])
      expect(item(g, id)?.done, id).toBe(true);
    const one = (over: Partial<AchievementTeamSlot>) => [
      ...dream.slice(0, 10),
      slot({ ballon: 1, nation: 'KR', peak: 95, ...over }),
    ];
    expect(item(judge(one({ ballon: 0 })), 'team-ballon')?.done).toBe(false);
    expect(item(judge(one({ nation: 'BR' })), 'team-nation')?.done).toBe(false);
    expect(item(judge(one({ peak: 94 })), 'team-ovr95')?.done).toBe(false);
    const sf = judge(dream, 'sf');
    expect(item(sf, 'team-cup-sf')?.done).toBe(true);
    expect(item(sf, 'team-cup-win')?.done).toBe(false);
    expect(item(judge(dream, 'qf'), 'team-cup-sf')?.done).toBe(false);
    expect(item(localizeAchievements(g, 'ja'), 'team-cup-win')?.label).toBe('オフサイドカップ優勝');
  });

  it('T-11-237 같은 구단에서 뛴 적 있음은 은퇴 구단과 따로, 11명 모두의 프로 구단이 하나라도 겹치면 달성한다', () => {
    const judge = (slots: AchievementTeamSlot[]) =>
      clubAchievements({
        careers: [],
        team: teamOf(slots),
        owner: OWNER,
        detail: true,
        retireAt: 41,
      });
    // 11명 모두 맨시티(pl-0)에서 뛰었지만 은퇴 구단은 제각각이다.
    const city = Array.from({ length: 11 }, (_, i) =>
      slot({ lastClubId: `ll-${i}`, clubIds: ['k1-0', 'pl-0', `ll-${i}`] }),
    );
    const g = judge(city);
    expect(item(g, 'team-mates')).toMatchObject({ done: true, points: 40 });
    expect(item(g, 'team-club')?.done).toBe(false);
    // 두 업적 모두 판정 기준을 한 줄로 알려 준다.
    expect(item(g, 'team-club')?.desc).toContain('은퇴');
    expect(item(g, 'team-mates')?.desc).toContain('프로 구단');
    // 한 명이라도 겹치는 구단이 없으면 미달성, 구단 기록을 모르는 선수도 미달성.
    expect(
      item(judge([...city.slice(0, 10), slot({ clubIds: ['bl-1'] })]), 'team-mates')?.done,
    ).toBe(false);
    expect(item(judge([...city.slice(0, 10), slot({ clubIds: [] })]), 'team-mates')?.done).toBe(
      false,
    );
    expect(item(judge(city.slice(0, 10)), 'team-mates')?.done).toBe(false);
    // 영어 응답은 기준도 영어로.
    const en = localizeAchievements(g, 'en');
    expect(item(en, 'team-mates')).toMatchObject({ label: 'All 11 once played for the same club' });
    expect(item(en, 'team-club')?.desc).toBe('All 11 must have retired at the same club.');
  });

  it('팀 적합도 업적은 정확히 11명, 유스 없이 모두 1.00일 때만 달성한다', () => {
    const done = (slots: AchievementTeamSlot[]) =>
      item(
        clubAchievements({
          careers: [],
          team: teamOf(slots),
          owner: OWNER,
          detail: true,
          retireAt: 41,
        }),
        'team-fit',
      )?.done;
    for (const count of [0, 1, 10, 12])
      expect(done(Array.from({ length: count }, () => slot()))).toBe(false);
    const full = Array.from({ length: 11 }, () => slot());
    expect(done(full)).toBe(true);
    expect(done([...full.slice(0, 10), slot({ fit: 0.99 })])).toBe(false);
    expect(done([...full.slice(0, 10), slot({ careerId: null, fit: 1 })])).toBe(false);
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
      owner: OWNER,
      detail: true,
      retireAt: 41,
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
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(not, 'one-club')?.done).toBe(false);
    expect(item(not, 'gk-cs-20')?.done).toBe(false);
  });

  it.each([
    [9, false],
    [10, true],
    [11, true],
  ])('한 구단 %i시즌 경계', (n, done) => {
    const g = clubAchievements({
      careers: [career({ seasons: pro(n, 'A') })],
      team: null,
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(g, 'one-club')?.done).toBe(done);
    expect(item(g, 'long-service')?.done).toBe(done);
  });

  it.each([
    ['return', [...pro(12, 'A'), ...pro(1, 'B'), ...pro(4, 'A')], true, false],
    ['sangmu return', [...pro(4, 'A'), ...sangmu(2), ...pro(4, 'A')], false, true],
    ['regular club 10 plus sangmu', [...pro(5, 'A'), ...sangmu(2), ...pro(5, 'A')], true, true],
    ['sangmu then B', [...pro(10, 'A'), ...sangmu(2), ...pro(1, 'B')], true, false],
    ['sangmu only', sangmu(10), false, false],
    ['name alone is not military evidence', [...pro(9, 'A'), ...pro(1, '김천 상무')], false, false],
    [
      'same id renamed and promoted',
      [
        ...pro(5, 'old').map((s) => ({ ...s, clubId: 'A', league: 'K리그2' })),
        ...pro(5, 'new').map((s) => ({ ...s, clubId: 'A', league: 'K리그1' })),
      ],
      true,
      true,
    ],
    [
      'same name different ids',
      [
        ...pro(5, 'same').map((s) => ({ ...s, clubId: 'A' })),
        ...pro(5, 'same').map((s) => ({ ...s, clubId: 'B' })),
      ],
      false,
      false,
    ],
    [
      'mixed old and new evidence',
      [...pro(5, 'A'), ...pro(5, 'A').map((s) => ({ ...s, clubId: 'A' }))],
      false,
      false,
    ],
    [
      'amateurs excluded',
      [
        ...pro(9, 'A'),
        season({ club: 'A', league: '고교 리그' }),
        season({ club: 'A', league: 'U리그 (대학)' }),
      ],
      false,
      false,
    ],
    ['army is not regular club tenure', army(10), false, false],
    ['army return', [...pro(4, 'A'), ...army(2), ...pro(4, 'A')], false, true],
    ['regular club 10 plus army', [...pro(5, 'A'), ...army(2), ...pro(5, 'A')], true, true],
    ['army then B', [...pro(10, 'A'), ...army(2), ...pro(1, 'B')], true, false],
  ])('%s', (_label, seasons, long, one) => {
    const g = clubAchievements({
      careers: [career({ seasons })],
      team: null,
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(item(g, 'long-service')?.done).toBe(long);
    expect(item(g, 'one-club')?.done).toBe(one);
    const en = localizeAchievements(g, 'en');
    expect(item(en, 'long-service')).toMatchObject({
      label: 'Long service',
      done: long,
      points: long ? 50 : 0,
    });
    expect(item(en, 'one-club')).toMatchObject({ label: 'One-club player', done: one });
  });

  it('장기근속은 여러 선수의 시즌을 합치지 않고 한 번만 50점이다', () => {
    const run = (careers: AchievementCareer[]) =>
      clubAchievements({ careers, team: null, owner: OWNER, detail: true, retireAt: 41 });
    expect(
      item(
        run([career({ seasons: pro(5, 'A') }), career({ seasons: pro(5, 'A') })]),
        'long-service',
      )?.done,
    ).toBe(false);
    const g = run([career({ seasons: pro(10, 'A') }), career({ seasons: pro(11, 'A') })]);
    expect(item(g, 'long-service')).toMatchObject({ done: true, points: 50, worth: 0 });
    const before = achievementScore(
      g.map((group) => ({ ...group, items: group.items.filter((i) => i.id !== 'long-service') })),
    );
    expect(achievementScore(g)).toEqual({ score: before.score + 50, done: before.done + 1 });
  });

  it('은퇴 직전까지 현역은 그 시즌 은퇴 나이의 한 살 아래 — 프리시즌(41세 은퇴) 40세, 시즌 1(45세 은퇴) 44세', () => {
    const age = (retireAge: number, retireAt: number) =>
      item(
        clubAchievements({
          careers: [career({ retireAge })],
          team: null,
          owner: OWNER,
          detail: true,
          retireAt,
        }),
        'age-40',
      );
    expect(age(40, 41)).toMatchObject({ label: '40세까지 현역', done: true });
    expect(age(39, 41)?.done).toBe(false);
    expect(age(44, 45)).toMatchObject({ label: '44세까지 현역', done: true });
    expect(age(45, 45)?.done).toBe(true);
    expect(age(43, 45)?.done).toBe(false);
    expect(age(40, 45)?.done).toBe(false);
  });

  it('트레블은 그 시즌 리그 · 대륙 대회 우승을 포함한 클럽 우승 3개(슈퍼컵 · 대표팀 제외)', () => {
    const t = (honors: string[]) =>
      item(
        clubAchievements({
          careers: [career({ seasons: [season({ honors })] })],
          team: null,
          owner: OWNER,
          detail: true,
          retireAt: 41,
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
      owner: OWNER,
      detail: true,
      retireAt: 41,
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

  it('점수: 한 번 달성은 단계별 점수, 단계 업적은 넘은 단계의 합, worth는 다음에 더 얻는 점수', () => {
    const g = clubAchievements({
      careers: [career({ goals: 370, ballon: 3 })],
      team: null,
      owner: OWNER,
      detail: false,
      retireAt: 41,
    });
    expect(item(g, 'retire-FW')).toMatchObject({ points: 10, worth: 0 });
    expect(item(g, 'retire-GK')).toMatchObject({ points: 0, worth: 10 });
    expect(item(g, 'goals')).toMatchObject({ level: 2, points: 30, worth: 40 });
    expect(item(g, 'ballon-3')).toMatchObject({ done: true, points: 50 });
    expect(item(g, 'world-cup')).toMatchObject({ points: 0, worth: 80 });
    expect(item(g, 'ballon-10')).toMatchObject({ points: 0, worth: 150 });
    const { score, done } = achievementScore(g);
    expect(score).toBe(g.flatMap((x) => x.items).reduce((t, i) => t + i.points, 0));
    expect(done).toBe(g.flatMap((x) => x.items).filter((i) => i.done).length);
  });

  it('팀 업적은 편성(내가 만든 최강 팀)과 시즌 레이스(경기 기록)로 나뉜다', () => {
    const g = clubAchievements({
      careers: [],
      team: teamOf([], {
        wins: 31,
        bestStreak: 5,
        bestMargin: 5,
        goalsFor: 60,
        rating: 1210,
        likes: 1,
      }),
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
    expect(g.filter((x) => x.category === 'team').map((x) => x.id)).toEqual(['team', 'race']);
    expect(item(g, 'team-wins')).toMatchObject({ level: 2, points: 60, worth: 80 });
    expect(item(g, 'team-streak')).toMatchObject({ level: 2, next: 10 });
    expect(item(g, 'team-margin')?.done).toBe(true);
    expect(item(g, 'team-goals')).toMatchObject({ level: 1 });
    expect(item(g, 'team-rating')).toMatchObject({ level: 2, next: 1300 });
    expect(item(g, 'team-likes')).toMatchObject({ level: 1, next: 5 });
  });

  it('팀 업적은 그 시즌에 한 번 닿으면 선발이 바뀌어도 남는다(T-11-103)', () => {
    const input = (team: AchievementTeam, kept?: ReturnType<typeof teamKeptOf>) =>
      clubAchievements({ careers: [], team, owner: OWNER, detail: true, retireAt: 41, kept });
    const first = input(
      teamOf(
        Array.from({ length: 11 }, () => slot()),
        { rating: 1210 },
      ),
    );
    const kept = teamKeptOf(first);
    expect(kept).toMatchObject({ 'team-full': 1, 'team-rn': 1, 'team-rating': 1210 });
    expect(kept['team-wins']).toBeUndefined();

    // 선수를 방출하려고 선발에서 빼고, 레이팅도 내려갔다.
    const after = input(teamOf([slot()], { rating: 1050 }), kept);
    for (const id of ['team-full', 'team-fit', 'team-caps', 'team-club', 'team-mates', 'team-rn'])
      expect(item(after, id)?.done, id).toBe(true);
    expect(item(after, 'team-rating')).toMatchObject({ level: 2, cur: 1210 });
    expect(achievementScore(after).score).toBe(achievementScore(first).score);
    // 기록 없이 같은 선발이면 풀린다(지금 팀으로만 판정).
    expect(item(input(teamOf([slot()])), 'team-full')?.done).toBe(false);
  });

  it('구단주 업적은 은퇴시킨 선수·날, 팀 경기한 날, 응원, 닉네임으로 센다', () => {
    const g = clubAchievements({
      careers: Array.from({ length: 10 }, () => career()),
      team: null,
      owner: { retireDays: 7, matchDays: 3, likesGiven: 5, nickname: true },
      detail: true,
      retireAt: 41,
    });
    expect(item(g, 'owner-nickname')?.done).toBe(true);
    expect(item(g, 'owner-players')).toMatchObject({ cur: 10, level: 2, next: 30 });
    expect(item(g, 'owner-retire-days')).toMatchObject({ level: 2, next: 14 });
    expect(item(g, 'owner-match-days')).toMatchObject({ level: 1, next: 7 });
    expect(item(g, 'owner-likes')).toMatchObject({ level: 2, next: 20 });
  });
});

describe('업적 영어 문구(T-11-106)', () => {
  const full = () =>
    clubAchievements({
      careers: [career({ goals: 120, seasons: [season({ goals: 3 })] })],
      team: teamOf([slot()]),
      owner: OWNER,
      detail: true,
      retireAt: 41,
    });
  const hangul = /[가-힣]/;

  it('한국어는 그대로, 영어는 모든 제목·단계·문구·단위가 영어이고 id·점수는 같다', () => {
    const ko = full();
    expect(localizeAchievements(ko, 'ko')).toBe(ko);
    const en = localizeAchievements(ko, 'en');
    expect(en.map((g) => g.id)).toEqual(ko.map((g) => g.id));
    for (const g of en) {
      expect(`${g.title} ${g.stage}`).not.toMatch(hangul);
      for (const i of g.items) {
        expect(`${i.label} ${i.unit ?? ''}`, i.id).not.toMatch(hangul);
        const k = item(ko, i.id)!;
        expect(i.points).toBe(k.points);
        expect(i.done).toBe(k.done);
      }
    }
    expect(item(en, 'goals')).toMatchObject({ label: 'Goals', unit: ' goals', cur: 120, level: 1 });
    expect(en[0]).toMatchObject({ stage: 'Stage 0', title: 'Where the story starts' });
    // T-11-588 영어 · 일본어 · 번체 중국어 모두 제목 · 단계 · 이름 · 단위 · 설명에 한글이 없다.
    for (const lang of ['en', 'ja', 'zh'] as const)
      for (const g of localizeAchievements(ko, lang)) {
        expect(`${g.title} ${g.stage}`, lang).not.toMatch(hangul);
        for (const i of g.items)
          expect(`${i.label} ${i.unit ?? ''} ${i.desc ?? ''}`, `${lang} ${i.id}`).not.toMatch(
            hangul,
          );
      }
    const ja = localizeAchievements(ko, 'ja');
    expect(item(ja, 'goals')).toMatchObject({ label: 'ゴール', unit: 'ゴール', cur: 120 });
    expect(item(ja, 'age-40')?.label).toBe('40歳まで現役');
  });

  it('시즌마다 나이가 다른 문구도 영어로 나온다', () => {
    const en = localizeAchievements(full(), 'en');
    expect(item(en, 'age-40')?.label).toBe('Still playing at 40');
  });
});

it('신규 포지션과 기존 포지션은 8개 기준 역할로 중복 없이 수집한다', () => {
  const g = clubAchievements({
    careers: [
      career({ pos: 'DF', dpos: 'FB' }),
      career({ pos: 'DF', dpos: 'LB' }),
      career({ pos: 'DF', dpos: 'RB' }),
      career({ pos: 'MF', dpos: 'CM' }),
      career({ pos: 'MF', dpos: 'LM' }),
    ],
    team: null,
    owner: OWNER,
    detail: true,
    retireAt: 45,
  });
  expect(item(g, 'all-dpos')).toMatchObject({ cur: 2, max: 8, done: false });
});
