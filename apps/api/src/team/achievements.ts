// T-10-092 구단 시즌 업적(클럽하우스). 그 시즌에 처음 올라와(careers.service_season) 은퇴한 내 선수들의 기록과 내 팀·팀
// 경기로 판정하는 순수 함수다. 판정 재료는 서버가 이미 받은 시즌 요약(career_seasons)·은퇴 요약(careers)뿐이다.
import type { ClubAchievement, ClubAchievementGroup } from '@offside/contracts';
import { DETAIL_POSITIONS, type DetailPos, type PosGroup } from '@offside/contracts/positions';

export type AchievementCareer = {
  pos: PosGroup;
  dpos: DetailPos | null;
  caps: number;
  ballon: number;
  trophies: number;
  awards: number;
  apps: number;
  goals: number;
  assists: number;
  legendScore: number;
  retiredNumber: boolean;
  /** 받아 둔 시즌(리그 이름 · 우승·수상 이름). */
  seasons: readonly { league: string; honors: readonly string[] }[];
};

/** 내 팀 선발(업적 판정에 쓰는 것만). 빈 자리는 careerId null. */
export type AchievementTeamSlot = {
  careerId: string | null;
  fit: number;
  lastClubId: string | null;
  caps: number;
  retiredNumber: boolean;
};

export type AchievementInput = {
  careers: readonly AchievementCareer[];
  /** 지금 팀(지난 시즌을 볼 때는 null — 팀 업적은 지금 팀으로만 판정한다). */
  team: readonly AchievementTeamSlot[] | null;
  /** 이 시즌 기간에 이긴 팀 경기 수. */
  teamWins: number;
  /** 세부 포지션이 있는 시즌(시즌 1부터)인가. */
  detail: boolean;
};

// 이름은 web game/data.ts LEAGUES · game/comps.ts(POTY·TOP_SCORER·YOUNG) · game/national.ts와 같다.
const BIG5 = ['프리미어리그', '라리가', '세리에 A', '분데스리가', '리그 1'];
const EUROPE = [...BIG5, '에레디비시'];
const LEAGUES = [...EUROPE, 'MLS', 'J1리그', 'K리그1', 'K리그2', 'K3리그'];
const POTY = [
  'PFA 올해의 선수',
  '라리가 올해의 선수',
  '세리에 A MVP',
  '분데스리가 올해의 선수',
  'UNFP 올해의 선수',
  '에레디비시 올해의 선수',
  'J리그 MVP',
  'MLS MVP',
  'K리그1 MVP',
  'K리그2 MVP',
  'K3리그 MVP',
];
const TOP_SCORER = [
  '프리미어리그 골든부트',
  '피치치 트로피',
  '카포칸노니에레',
  '토르예거카논',
  '리그 1 득점왕',
  '에레디비시 득점왕',
  'J리그 득점왕',
  'MLS 골든부트',
  'K리그1 득점왕',
  'K리그2 득점왕',
  'K3리그 득점왕',
];
const YOUNG = [
  'PFA 올해의 영플레이어',
  'K리그1 영플레이어상',
  'K리그2 영플레이어상',
  'J리그 베스트 영플레이어상',
];
const NATIONAL_WIN = [
  'FIFA 월드컵 우승',
  'AFC 아시안컵 우승',
  '아시안게임 금메달',
  '올림픽 금메달',
];

const POS_FIRST: [PosGroup, string][] = [
  ['FW', '공격수 1명 은퇴'],
  ['MF', '미드필더 1명 은퇴'],
  ['DF', '수비수 1명 은퇴'],
  ['GK', '골키퍼 1명 은퇴'],
];

/** 단계 업적의 목표(오름차순). */
const TIERS: {
  id: string;
  label: string;
  unit: string;
  get: (c: AchievementCareer) => number;
  steps: number[];
}[] = [
  {
    id: 'goals',
    label: '골',
    unit: '골',
    get: (c) => c.goals,
    steps: [100, 300, 1000, 3000, 10000],
  },
  {
    id: 'assists',
    label: '도움',
    unit: '도움',
    get: (c) => c.assists,
    steps: [100, 300, 1000, 3000, 10000],
  },
  {
    id: 'apps',
    label: '출전',
    unit: '경기',
    get: (c) => c.apps,
    steps: [1000, 3000, 10000, 30000],
  },
  {
    id: 'caps',
    label: 'A매치 출전',
    unit: '경기',
    get: (c) => c.caps,
    steps: [100, 300, 1000, 3000],
  },
  { id: 'trophies', label: '우승', unit: '회', get: (c) => c.trophies, steps: [10, 30, 100, 300] },
  { id: 'awards', label: '개인 수상', unit: '회', get: (c) => c.awards, steps: [10, 30, 100, 300] },
  {
    id: 'legend',
    label: '레전드 점수',
    unit: '점',
    get: (c) => c.legendScore,
    steps: [1000, 3000, 10000, 30000],
  },
];

const once = (id: string, label: string, done: boolean): ClubAchievement => ({ id, label, done });
const collect = (id: string, label: string, cur: number, max: number): ClubAchievement => ({
  id,
  label,
  done: cur >= max,
  cur: Math.min(cur, max),
  max,
});
const tier = (id: string, label: string, unit: string, cur: number, steps: number[]) => {
  const level = steps.filter((s) => cur >= s).length;
  return { id, label, unit, done: level > 0, cur, level, next: steps[level] ?? null };
};

export function clubAchievements(input: AchievementInput): ClubAchievementGroup[] {
  const { careers, team, teamWins, detail } = input;
  const honors = new Set(careers.flatMap((c) => c.seasons.flatMap((s) => s.honors)));
  const leagues = new Set(careers.flatMap((c) => c.seasons.map((s) => s.league)));
  const has = (names: readonly string[]) => names.filter((n) => honors.has(n)).length;
  const dposOf = (pred: (c: AchievementCareer) => boolean) =>
    new Set(careers.filter(pred).flatMap((c) => (c.dpos ? [c.dpos] : []))).size;
  const sum = (get: (c: AchievementCareer) => number) => careers.reduce((t, c) => t + get(c), 0);

  const first: ClubAchievement[] = [
    ...POS_FIRST.map(([pos, label]) =>
      once(
        `retire-${pos}`,
        label,
        careers.some((c) => c.pos === pos),
      ),
    ),
    once('national-win', '첫 국제대회 우승', has(NATIONAL_WIN) > 0),
    once(
      'europe',
      '첫 유럽 진출',
      EUROPE.some((l) => leagues.has(l)),
    ),
    once(
      'retired-number',
      '첫 영구결번',
      careers.some((c) => c.retiredNumber),
    ),
    once('poty', '첫 리그 올해의 선수', has(POTY) > 0),
    once(
      'ballon',
      '첫 발롱도르',
      careers.some((c) => c.ballon > 0),
    ),
    once('team-win', '팀 경기 첫 승', teamWins > 0),
    ...(detail
      ? [
          collect(
            'all-dpos',
            '전 세부 포지션 선수 배출',
            dposOf(() => true),
            DETAIL_POSITIONS.length,
          ),
        ]
      : []),
  ];

  const collection: ClubAchievement[] = [
    collect('all-league-win', '전 리그 우승', has(LEAGUES.map((l) => `${l} 우승`)), LEAGUES.length),
    collect('all-top-scorer', '전 리그 득점왕', has(TOP_SCORER), TOP_SCORER.length),
    collect('all-poty', '전 리그 올해의 선수', has(POTY), POTY.length),
    collect('young', '영플레이어상 수집', has(YOUNG), YOUNG.length),
    collect(
      'big5',
      '빅5 리그 모두 뛰어 보기',
      BIG5.filter((l) => leagues.has(l)).length,
      BIG5.length,
    ),
    ...(detail
      ? [
          collect(
            'all-dpos-ballon',
            '전 세부 포지션 발롱도르',
            dposOf((c) => c.ballon > 0),
            DETAIL_POSITIONS.length,
          ),
        ]
      : []),
  ];

  const groups: ClubAchievementGroup[] = [
    { id: 'first', stage: '0단계', title: '축구 인생 출발', items: first },
    {
      id: 'records',
      stage: '1단계',
      title: '기록 쌓기',
      items: TIERS.map((t) => tier(t.id, t.label, t.unit, sum(t.get), t.steps)),
    },
    { id: 'collection', stage: '2단계', title: '기록 조각 모으기', items: collection },
  ];

  if (team) {
    const players = team.filter((s) => s.careerId !== null);
    const full = team.length > 0 && players.length === team.length;
    const all = (pred: (s: AchievementTeamSlot) => boolean) => full && players.every(pred);
    const club = players[0]?.lastClubId;
    groups.push({
      id: 'team',
      stage: 'TEAM',
      title: '나만의 최강 팀',
      items: [
        once('team-one', '팀에 선수 한 명 등록', players.length > 0),
        once('team-full', '유스 없이 11명 채우기', full),
        once(
          'team-fit',
          '11명 모두 제자리',
          all((s) => s.fit >= 1),
        ),
        once(
          'team-club',
          '11명 모두 같은 구단 출신',
          all((s) => !!club && s.lastClubId === club),
        ),
        once(
          'team-caps',
          '11명 모두 A대표 경험',
          all((s) => s.caps > 0),
        ),
        once(
          'team-rn',
          '11명 모두 영구결번',
          all((s) => s.retiredNumber),
        ),
        tier('team-wins', '팀 경기 승리', '승', teamWins, [10, 30, 100]),
      ],
    });
  }
  return groups;
}
