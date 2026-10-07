// T-10-092 구단 시즌 업적(클럽하우스). 그 시즌에 처음 올라와(careers.service_season) 은퇴한 내 선수들의 기록과 그 시즌
// 내 팀·팀 경기로 판정하는 순수 함수다. 판정 재료는 서버가 이미 받은 시즌 요약(career_seasons)·은퇴 요약(careers)뿐이다.
// T-11-026 잠겨 있던 3~5단계를 연다 — 3단계 한 선수의 위업, 4단계 세계 무대 우승, 5단계 구단 전체의 불멸 기록.
// 목표치는 운영 은퇴 기록 분포(2026-10-01, 은퇴 8천여 명)로 3단계는 선수 몇십 명 중 하나, 5단계는 손꼽히는 구단주만 닿게 잡았다.
// T-11-028 업적을 선수·팀·구단주·감독(준비 중)으로 나누고 업적마다 점수를 매긴다. 점수 합이 그 시즌 구단주 등급과 업적
// 랭킹이 된다 — 시즌마다 처음부터 다시 쌓는다. 팀은 편성(나만의 최강 팀)과 경기 성적(시즌 레이스)으로, 구단주는 시즌 동안
// 꾸준히 찾아온 활동(은퇴시킨 선수·날, 팀 경기한 날, 응원)으로 센다. 팀·구단주 목표치는 프리시즌 팀 53개 분포(2026-10-01)로 잡았다.
// T-11-046 '은퇴 직전까지 현역'은 그 시즌 은퇴 나이(T-11-045)의 한 살 아래다 — 프리시즌 40세, 시즌 1 44세.
import type { ClubAchievement, ClubAchievementGroup } from '@offside/contracts';
import { LINEUP_SIZE, type AchCategory } from '@offside/contracts/owner-team';
import { LEAGUE_BASE } from '@offside/contracts/club-names';
import { DETAIL_POSITIONS, type DetailPos, type PosGroup } from '@offside/contracts/positions';
import { tenureLabels } from '../i18n/ko/achievements.js';
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
  /** 저장된 소속 이름. */
  club: string;
  /** 안정적인 구단 식별값. 옛 기록에는 없을 수 있다. */
  clubId?: string | null;
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

/** 그 시즌 내 팀(owner_teams 기록). 아직 팀이 없는 지금 시즌은 빈 선발과 0으로 채운다. */
export type AchievementTeam = {
  slots: readonly AchievementTeamSlot[];
  wins: number;
  bestStreak: number;
  bestMargin: number;
  goalsFor: number;
  rating: number;
  likes: number;
};

/** 그 시즌 구단주 활동. */
export type AchievementOwner = {
  /** 선수를 은퇴시킨 날 수(한국 시각). */
  retireDays: number;
  /** 팀 경기를 건 날 수(한국 시각). */
  matchDays: number;
  /** 다른 팀에 누른 좋아요 수. */
  likesGiven: number;
  /** 공개 닉네임을 정했다. */
  nickname: boolean;
};

export type AchievementInput = {
  careers: readonly AchievementCareer[];
  /** 그 시즌 팀(팀이 없는 지난 시즌이면 null — 팀 업적을 보이지 않는다). */
  team: AchievementTeam | null;
  owner: AchievementOwner;
  /** 세부 포지션이 있는 시즌(시즌 1부터)인가. */
  detail: boolean;
  /** T-11-046 그 시즌 선수의 은퇴 나이(retireAtOf). */
  retireAt: number;
  /** T-11-103 그 시즌에 이미 닿은 팀 업적(teamKeptOf). 없으면 지금 팀으로만 판정한다. */
  kept?: TeamKept | undefined;
};

/** 팀 업적 id → 그 시즌에 닿은 값(한 번 달성은 1, 단계 업적은 최고 값). */
export type TeamKept = Readonly<Record<string, number>>;

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
/** 이름만 있는 옛 기록과 id가 있는 기록은 추정해서 합치지 않는다. */
const clubKey = (s: AchievementSeason) => (s.clubId ? `id:${s.clubId}` : `name:${s.club}`);
const proSeasons = (c: AchievementCareer) => c.seasons.filter((s) => !AMATEUR.has(s.league));
/**
 * 일반 구단 시즌인지. 병역(게임 엔진의 상무 구단 id, 현역 복무의 리그 저장값)은 아니다. 이름이 '김천 상무'라는 이유로
 * 군 복무로 간주하지 않는다.
 */
// i18n-ignore 저장된 리그 식별값.
const ordinary = (s: AchievementSeason) => s.clubId !== 'sangmu' && s.league !== '병역';
/** 총 프로 10시즌 이상. 병역(상무·현역)은 구단 다양성 판단에서만 제외한다. */
const oneClub = (c: AchievementCareer) => {
  const pro = proSeasons(c);
  return pro.length >= 10 && new Set(pro.filter(ordinary).map(clubKey)).size === 1;
};
/** 한 선수의 같은 일반 구단 시즌을 복귀 전후 합산한다. 병역(상무·현역) 시즌은 제외한다. */
const longService = (c: AchievementCareer) => {
  const counts = new Map<string, number>();
  for (const s of proSeasons(c).filter(ordinary)) {
    const key = clubKey(s);
    const n = (counts.get(key) ?? 0) + 1;
    if (n >= 10) return true;
    counts.set(key, n);
  }
  return false;
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

/** 단계마다 매기는 점수(한 번 달성 · 모으기). 단계 업적은 단계마다 LADDER를 쓴다. */
const PTS = { first: 10, collection: 30, legend: 50, world: 80, immortal: 150 } as const;
/** 단계 업적의 단계별 점수(앞에서부터 목표 수만큼). */
const LADDER = [10, 20, 40, 80, 160];
const TEAM_LADDER = [20, 40, 80];

const once = (id: string, label: string, done: boolean, pts: number): ClubAchievement => ({
  id,
  label,
  done,
  points: done ? pts : 0,
  worth: done ? 0 : pts,
});
const collect = (
  id: string,
  label: string,
  cur: number,
  max: number,
  pts: number,
): ClubAchievement => ({
  ...once(id, label, cur >= max, pts),
  cur: Math.min(cur, max),
  max,
});
const tier = (
  id: string,
  label: string,
  unit: string,
  cur: number,
  steps: readonly number[],
  ladder: readonly number[] = LADDER,
): ClubAchievement => {
  const level = steps.filter((s) => cur >= s).length;
  return {
    id,
    label,
    unit,
    done: level > 0,
    cur,
    level,
    next: steps[level] ?? null,
    points: ladder.slice(0, level).reduce((t, p) => t + p, 0),
    worth: ladder[level] ?? 0,
  };
};
const group = (
  category: AchCategory,
  id: string,
  stage: string,
  title: string,
  items: ClubAchievement[],
): ClubAchievementGroup => ({ id, category, stage, title, items });

/** T-11-103 다음 계산에 넘길 팀 업적 기록 — 팀 분류에서 닿은 것만(한 번 달성은 1, 단계 업적은 그 값). */
export function teamKeptOf(groups: readonly ClubAchievementGroup[]): TeamKept {
  const kept: Record<string, number> = {};
  for (const i of groups.filter((g) => g.category === 'team').flatMap((g) => g.items)) {
    const v = i.level !== undefined ? (i.cur ?? 0) : i.done ? 1 : 0;
    if (v > 0) kept[i.id] = v;
  }
  return kept;
}

/** 시즌 업적 점수(달성한 업적 점수의 합)와 달성한 업적 수. */
export function achievementScore(groups: readonly ClubAchievementGroup[]) {
  const items = groups.flatMap((g) => g.items);
  return {
    score: items.reduce((t, i) => t + i.points, 0),
    done: items.filter((i) => i.done).length,
  };
}

export function clubAchievements(input: AchievementInput): ClubAchievementGroup[] {
  const { careers, team, owner, detail, retireAt } = input;
  const veteranAge = retireAt - 1;
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
  const first = (id: string, label: string, done: boolean) => once(id, label, done, PTS.first);
  const piece = (id: string, label: string, cur: number, max: number) =>
    collect(id, label, cur, max, PTS.collection);
  const feat = (id: string, label: string, done: boolean) => once(id, label, done, PTS.legend);
  const world = (id: string, label: string, done: boolean) => once(id, label, done, PTS.world);

  const firsts: ClubAchievement[] = [
    ...POS_FIRST.map(([pos, label]) =>
      first(
        `retire-${pos}`,
        label,
        anyone((c) => c.pos === pos),
      ),
    ),
    first('national-win', '첫 국제대회 우승', has(NATIONAL_WINS) > 0),
    first(
      'europe',
      '첫 유럽 진출',
      EUROPE.some((l) => leagues.has(l)),
    ),
    first(
      'retired-number',
      '첫 영구결번',
      anyone((c) => c.retiredNumber),
    ),
    first('poty', '첫 리그 올해의 선수', has(POTY) > 0),
    first(
      'ballon',
      '첫 발롱도르',
      anyone((c) => c.ballon > 0),
    ),
    first('team-win', '팀 경기 첫 승', (team?.wins ?? 0) > 0),
    ...(detail
      ? [
          collect(
            'all-dpos',
            '전 세부 포지션 선수 배출',
            dposOf(() => true),
            DETAIL_POSITIONS.length,
            PTS.first,
          ),
        ]
      : []),
  ];

  const collection: ClubAchievement[] = [
    piece('all-league-win', '전 리그 우승', has(LEAGUES.map((l) => `${l} 우승`)), LEAGUES.length),
    piece('all-top-scorer', '전 리그 득점왕', has(TOP_SCORER), TOP_SCORER.length),
    piece('all-poty', '전 리그 올해의 선수', has(POTY), POTY.length),
    piece('young', '영플레이어상 수집', has(YOUNG), YOUNG.length),
    piece(
      'big5',
      '빅5 리그 모두 뛰어 보기',
      BIG5.filter((l) => leagues.has(l)).length,
      BIG5.length,
    ),
    ...(detail
      ? [
          piece(
            'all-dpos-ballon',
            '전 세부 포지션 발롱도르',
            dposOf((c) => c.ballon > 0),
            DETAIL_POSITIONS.length,
          ),
        ]
      : []),
  ];

  const groups: ClubAchievementGroup[] = [
    group('player', 'first', '0단계', '축구 인생 출발', firsts),
    group(
      'player',
      'records',
      '1단계',
      '기록 쌓기',
      TIERS.map((t) => tier(t.id, t.label, t.unit, sum(t.get), t.steps)),
    ),
    group('player', 'collection', '2단계', '기록 조각 모으기', collection),
    group('player', 'legend', '3단계', '전설의 한 명', [
      feat('one-club', tenureLabels['one-club'], anyone(oneClub)),
      feat('long-service', tenureLabels['long-service'], anyone(longService)),
      feat(
        'caps-150',
        'A매치 150경기 선수',
        anyone((c) => c.caps >= 150),
      ),
      feat(
        'goals-500',
        '통산 500골 선수',
        anyone((c) => c.goals >= 500),
      ),
      feat(
        'season-50',
        '한 시즌 50골',
        anySeason((s) => s.goals >= 50),
      ),
      feat(
        'gk-cs-20',
        '골키퍼 한 시즌 무실점 20경기',
        anySeason((s, c) => c.pos === 'GK' && (s.cs ?? 0) >= 20),
      ),
      feat(
        'treble',
        '한 시즌 트레블',
        anySeason((s) => treble(s)),
      ),
      // id는 그대로 둔다(프리시즌 기준 이름).
      feat(
        'age-40',
        `${veteranAge}세까지 현역`,
        anyone((c) => c.retireAge >= veteranAge),
      ),
      feat(
        'ballon-3',
        '발롱도르 3회 선수',
        anyone((c) => c.ballon >= 3),
      ),
    ]),
    group('player', 'world', '4단계', '세계 무대 정복', [
      world('world-cup', 'FIFA 월드컵 우승', honors.has('FIFA 월드컵 우승')),
      world('conf-cup', '대륙컵 우승', has(CONF_CUPS) > 0),
      world('olympic', '올림픽 금메달', honors.has('올림픽 금메달')),
      world('ucl', 'UEFA 챔피언스리그 우승', honors.has('UEFA 챔피언스리그 우승')),
      world('club-wc', 'FIFA 클럽 월드컵 우승', honors.has('FIFA 클럽 월드컵 우승')),
      world('golden-shoe', '유러피언 골든슈', honors.has('유러피언 골든슈')),
      collect(
        'all-continental',
        '대륙 클럽 대회 모두 우승',
        has(CONTINENTAL),
        CONTINENTAL.length,
        PTS.world,
      ),
      collect(
        'nations',
        '국적이 다른 선수 5명',
        new Set(careers.flatMap((c) => (c.nation ? [c.nation] : []))).size,
        5,
        PTS.world,
      ),
    ]),
    group('player', 'immortal', '5단계', '불멸의 구단', [
      collect(
        'rn-11',
        '영구결번 11명',
        careers.filter((c) => c.retiredNumber).length,
        11,
        PTS.immortal,
      ),
      collect(
        'ballon-30',
        '발롱도르 합계 30회',
        sum((c) => c.ballon),
        30,
        PTS.immortal,
      ),
      collect(
        'ballon-pos',
        '네 포지션 모두 발롱도르',
        POS.filter((p) => anyone((c) => c.pos === p && c.ballon > 0)).length,
        POS.length,
        PTS.immortal,
      ),
      collect('world-cup-3', '월드컵 우승 3번', honorCount('FIFA 월드컵 우승'), 3, PTS.immortal),
      once(
        'ballon-10',
        '발롱도르 10회 선수',
        anyone((c) => c.ballon >= 10),
        PTS.immortal,
      ),
      once(
        'goals-800',
        '통산 800골 선수',
        anyone((c) => c.goals >= 800),
        PTS.immortal,
      ),
      once(
        'legend-3000',
        '레전드 점수 3,000점 선수',
        anyone((c) => c.legendScore >= 3000),
        PTS.immortal,
      ),
    ]),
  ];

  if (team) {
    const players = team.slots.filter((s) => s.careerId !== null);
    const full = team.slots.length === LINEUP_SIZE && players.length === LINEUP_SIZE;
    const all = (pred: (s: AchievementTeamSlot) => boolean) => full && players.every(pred);
    const club = players[0]?.lastClubId;
    // T-11-103 팀 업적은 그 시즌에 한 번 닿으면 남는다 — 선수를 팔거나 방출해 선발이 바뀌어도, 레이팅·좋아요가 내려가도.
    const kept = input.kept ?? {};
    const held = (id: string, label: string, done: boolean, pts: number) =>
      once(id, label, done || (kept[id] ?? 0) > 0, pts);
    const best = (id: string, label: string, unit: string, cur: number, steps: number[]) =>
      tier(id, label, unit, Math.max(cur, kept[id] ?? 0), steps, TEAM_LADDER);
    groups.push(
      group('team', 'team', 'TEAM', '나만의 최강 팀', [
        held('team-one', '팀에 선수 한 명 등록', players.length > 0, 10),
        held('team-full', '유스 없이 11명 채우기', full, 20),
        held(
          'team-fit',
          '11명 모두 제자리',
          all((s) => s.fit >= 1),
          30,
        ),
        held(
          'team-caps',
          '11명 모두 A대표 경험',
          all((s) => s.caps > 0),
          40,
        ),
        held(
          'team-club',
          '11명 모두 같은 구단 출신',
          all((s) => !!club && s.lastClubId === club),
          60,
        ),
        held(
          'team-rn',
          '11명 모두 영구결번',
          all((s) => s.retiredNumber),
          150,
        ),
      ]),
      group('team', 'race', 'RACE', '시즌 레이스', [
        best('team-wins', '팀 경기 승리', '승', team.wins, [10, 30, 100]),
        best('team-streak', '최다 연승', '연승', team.bestStreak, [3, 5, 10]),
        held('team-margin', '5골 차 이상 승리', team.bestMargin >= 5, 30),
        best('team-goals', '팀 득점', '골', team.goalsFor, [50, 150, 500]),
        best('team-rating', '팀 레이팅', '점', team.rating, [1100, 1200, 1300]),
        best('team-likes', '받은 좋아요', '개', team.likes, [1, 5, 20]),
      ]),
    );
  }

  groups.push(
    group('owner', 'owner', 'OWNER', '구단 운영', [
      once('owner-nickname', '공개 닉네임 정하기', owner.nickname, 10),
      tier('owner-players', '은퇴시킨 선수', '명', careers.length, [3, 10, 30, 100]),
      tier('owner-retire-days', '선수를 은퇴시킨 날', '일', owner.retireDays, [3, 7, 14, 30]),
      tier('owner-match-days', '팀 경기를 치른 날', '일', owner.matchDays, [3, 7, 14, 30]),
      tier('owner-likes', '다른 팀 응원(좋아요)', '번', owner.likesGiven, [1, 5, 20], TEAM_LADDER),
    ]),
    // 감독 시뮬레이션이 열리면 공개한다(지금은 잠금으로 예고만).
    { ...group('manager', 'manager', 'MANAGER', '감독 커리어', []), locked: true },
  );
  return groups;
}
