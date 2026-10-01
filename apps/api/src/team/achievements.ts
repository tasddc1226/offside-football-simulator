// T-10-092 구단 시즌 업적(클럽하우스). 그 시즌에 처음 올라와(careers.service_season) 은퇴한 내 선수들의 기록과 그 시즌
// 내 팀·팀 경기로 판정하는 순수 함수다. 판정 재료는 서버가 이미 받은 시즌 요약(career_seasons)·은퇴 요약(careers)뿐이다.
// T-11-026 잠겨 있던 3~5단계를 연다 — 3단계 한 선수의 위업, 4단계 세계 무대 우승, 5단계 구단 전체의 불멸 기록.
// 목표치는 운영 은퇴 기록 분포(2026-10-01, 은퇴 8천여 명)로 3단계는 선수 몇십 명 중 하나, 5단계는 손꼽히는 구단주만 닿게 잡았다.
import type { ClubAchievement, ClubAchievementGroup } from '@offside/contracts';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { DETAIL_POSITIONS, type DetailPos, type PosGroup } from '@offside/contracts/positions';
import { NATIONAL_WINS } from '@offside/contracts/nations';

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
  /** 국적(옛 기록은 null). */
  nation: string | null;
  retireAge: number;
  /** 받아 둔 시즌. */
  seasons: readonly AchievementSeason[];
};

export type AchievementSeason = {
  league: string;
  /** 우승·수상 이름. */
  honors: readonly string[];
  /** 소속(클럽 id, 옛 기록은 이름). */
  club: string;
  goals: number;
  /** 무실점 경기(옛 기록은 null). */
  cs: number | null;
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
  /** 그 시즌 팀의 선발(팀이 없는 지난 시즌이면 null — 팀 업적 단계를 보이지 않는다). */
  team: readonly AchievementTeamSlot[] | null;
  /** 그 시즌 팀이 이긴 경기 수. */
  teamWins: number;
  /** 세부 포지션이 있는 시즌(시즌 1부터)인가. */
  detail: boolean;
};

// 리그는 contracts LEAGUE_BASE(프로 리그 · 유럽 = 등급 4 이상 · 5대 리그 = 등급 5 이상). 상 이름은 web game/comps.ts
// (POTY·TOP_SCORER·YOUNG) · game/national.ts와 같다.
const leaguesFrom = (minTier: number) =>
  LEAGUE_BASE.filter((l) => !l.amateur && l.tier >= minTier).map((l) => l.name);
const LEAGUES = leaguesFrom(0);
const EUROPE = leaguesFrom(4);
const BIG5 = leaguesFrom(5);
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

const AMATEUR = new Set(LEAGUE_BASE.filter((l) => l.amateur).map((l) => l.name));
/** 대륙 클럽 대회 우승(game/comps.ts 대륙 대회 이름). */
const CONTINENTAL = [
  'UEFA 챔피언스리그 우승',
  'AFC 챔피언스리그 엘리트 우승',
  'CONCACAF 챔피언스컵 우승',
];
const CONF_CUPS = NATIONAL_WINS.filter(
  (n) => n !== 'FIFA 월드컵 우승' && n !== '아시안게임 금메달' && n !== '올림픽 금메달',
);
/** 트레블에서 세지 않는 우승(단판 슈퍼컵 · 대표팀 · 클럽 월드컵). */
const NOT_TREBLE = /슈퍼컵|수페르코파|실드|샹피옹|클럽 월드컵/;
const NATIONAL = new Set(NATIONAL_WINS);
/** 한 시즌 트레블 — 그 시즌 리그 우승과 대륙 클럽 대회 우승을 포함해 클럽 우승 3개. */
const treble = (s: AchievementSeason) =>
  s.honors.includes(`${s.league} 우승`) &&
  CONTINENTAL.some((h) => s.honors.includes(h)) &&
  s.honors.filter((h) => h.endsWith(' 우승') && !NATIONAL.has(h) && !NOT_TREBLE.test(h)).length >=
    3;
/** 원클럽맨 — 프로로 10시즌 넘게 뛰며 한 구단에만 있었다. */
const oneClub = (c: AchievementCareer) => {
  const pro = c.seasons.filter((s) => !AMATEUR.has(s.league));
  return pro.length >= 10 && new Set(pro.map((s) => s.club)).size === 1;
};
const POS: PosGroup[] = ['FW', 'MF', 'DF', 'GK'];

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
  const anyone = (pred: (c: AchievementCareer) => boolean) => careers.some(pred);
  const anySeason = (pred: (s: AchievementSeason, c: AchievementCareer) => boolean) =>
    careers.some((c) => c.seasons.some((s) => pred(s, c)));
  /** 모든 선수의 시즌에서 그 이름을 받은 횟수. */
  const honorCount = (name: string) =>
    sum((c) => c.seasons.filter((s) => s.honors.includes(name)).length);

  const first: ClubAchievement[] = [
    ...POS_FIRST.map(([pos, label]) =>
      once(
        `retire-${pos}`,
        label,
        careers.some((c) => c.pos === pos),
      ),
    ),
    once('national-win', '첫 국제대회 우승', has(NATIONAL_WINS) > 0),
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
    {
      id: 'legend',
      stage: '3단계',
      title: '전설의 한 명',
      items: [
        once('one-club', '원클럽맨 — 프로 10시즌 넘게 한 구단', anyone(oneClub)),
        once(
          'caps-150',
          'A매치 150경기 선수',
          anyone((c) => c.caps >= 150),
        ),
        once(
          'goals-500',
          '통산 500골 선수',
          anyone((c) => c.goals >= 500),
        ),
        once(
          'season-50',
          '한 시즌 50골',
          anySeason((s) => s.goals >= 50),
        ),
        once(
          'gk-cs-20',
          '골키퍼 한 시즌 무실점 20경기',
          anySeason((s, c) => c.pos === 'GK' && (s.cs ?? 0) >= 20),
        ),
        once(
          'treble',
          '한 시즌 트레블',
          anySeason((s) => treble(s)),
        ),
        once(
          'age-40',
          '40세까지 현역',
          anyone((c) => c.retireAge >= 40),
        ),
        once(
          'ballon-3',
          '발롱도르 3회 선수',
          anyone((c) => c.ballon >= 3),
        ),
      ],
    },
    {
      id: 'world',
      stage: '4단계',
      title: '세계 무대 정복',
      items: [
        once('world-cup', 'FIFA 월드컵 우승', honors.has('FIFA 월드컵 우승')),
        once('conf-cup', '대륙컵 우승', has(CONF_CUPS) > 0),
        once('olympic', '올림픽 금메달', honors.has('올림픽 금메달')),
        once('ucl', 'UEFA 챔피언스리그 우승', honors.has('UEFA 챔피언스리그 우승')),
        once('club-wc', 'FIFA 클럽 월드컵 우승', honors.has('FIFA 클럽 월드컵 우승')),
        once('golden-shoe', '유러피언 골든슈', honors.has('유러피언 골든슈')),
        collect(
          'all-continental',
          '대륙 클럽 대회 모두 우승',
          has(CONTINENTAL),
          CONTINENTAL.length,
        ),
        collect(
          'nations',
          '국적이 다른 선수 5명',
          new Set(careers.flatMap((c) => (c.nation ? [c.nation] : []))).size,
          5,
        ),
      ],
    },
    {
      id: 'immortal',
      stage: '5단계',
      title: '불멸의 구단',
      items: [
        collect('rn-11', '영구결번 11명', careers.filter((c) => c.retiredNumber).length, 11),
        collect(
          'ballon-30',
          '발롱도르 합계 30회',
          sum((c) => c.ballon),
          30,
        ),
        collect(
          'ballon-pos',
          '네 포지션 모두 발롱도르',
          POS.filter((p) => anyone((c) => c.pos === p && c.ballon > 0)).length,
          POS.length,
        ),
        collect('world-cup-3', '월드컵 우승 3번', honorCount('FIFA 월드컵 우승'), 3),
        once(
          'ballon-10',
          '발롱도르 10회 선수',
          anyone((c) => c.ballon >= 10),
        ),
        once(
          'goals-800',
          '통산 800골 선수',
          anyone((c) => c.goals >= 800),
        ),
        once(
          'legend-3000',
          '레전드 점수 3,000점 선수',
          anyone((c) => c.legendScore >= 3000),
        ),
      ],
    },
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
