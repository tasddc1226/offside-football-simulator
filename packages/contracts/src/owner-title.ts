// T-11-150 컵 성적과 여러 시즌의 육성 이력을 담는 대표 칭호. zod 없는 공통 서브패스.
import { divisionRank, type CupDivision, type CupStage } from './cup.js';

export const TITLE_STAGES = ['champion', 'runnerup', 'sf'] as const;
export type TitleStage = (typeof TITLE_STAGES)[number];
/** 'cup-1-champion' 같은 칭호 id. T-11-410 구간 대회는 'cup-3-master-champion'. T-11-418e 리그 1부 우승은 'league-2-champion'. */
export type OwnerTitle = string;

/** 칭호를 받는 성적(우승·준우승·4강)인가. */
export const isTitleStage = (stage: string): stage is TitleStage =>
  (TITLE_STAGES as readonly string[]).includes(stage);

export const TITLE_RE = /^cup-([1-9]\d{0,3})(?:-(junior|senior|master))?-(champion|runnerup|sf)$/;
/** T-11-418e 오프사이드 리그 1부 우승(시즌 번호). */
export const LEAGUE_TITLE_RE = /^league-([1-9]\d{0,3})-champion$/;
export const leagueTitleIdOf = (season: number): OwnerTitle => `league-${season}-champion`;
/** 칭호를 달지 않기로 고른 상태(대표 칭호 PUT 본문). */
export const TITLE_NONE = 'none';

export const titleIdOf = (
  edition: number,
  stage: TitleStage,
  division?: CupDivision | null,
): OwnerTitle => `cup-${edition}${division ? `-${division}` : ''}-${stage}`;

/**
 * 트로피 칭호(컵 · 리그) 읽기. 리그 우승은 edition에 시즌 번호, league: true — 트로피는 컵 우승과 같은 금빛으로 그린다.
 */
export function parseTitle(
  id: string | null | undefined,
): { edition: number; stage: TitleStage; division?: CupDivision; league?: true } | null {
  const l = id ? LEAGUE_TITLE_RE.exec(id) : null;
  if (l) return { edition: Number(l[1]), stage: 'champion', league: true };
  const m = id ? TITLE_RE.exec(id) : null;
  if (!m) return null;
  const division = m[2] as CupDivision | undefined;
  return { edition: Number(m[1]), stage: m[3] as TitleStage, ...(division ? { division } : {}) };
}

const STAGE_RANK: Record<TitleStage, number> = { champion: 0, runnerup: 1, sf: 2 };

/**
 * 칭호 순서: 우승 > 준우승 > 4강, 같은 단계면 리그 우승 → 윗 구간(통합 대회는 마스터와 같은 줄) 먼저, 그다음 최근 회차 먼저.
 * 진열장·자동 대표 칭호가 같이 쓴다.
 */
function compareTitles(a: OwnerTitle, b: OwnerTitle): number {
  const x = parseTitle(a);
  const y = parseTitle(b);
  if (!x || !y) return x ? -1 : y ? 1 : 0;
  const tier = (t: { division?: CupDivision }) =>
    Math.min(divisionRank(t.division), divisionRank('master'));
  return (
    STAGE_RANK[x.stage] - STAGE_RANK[y.stage] ||
    Number(!!y.league) - Number(!!x.league) ||
    tier(y) - tier(x) ||
    y.edition - x.edition
  );
}

/** 컵 성적 · 리그 1부 우승 시즌에서 받은 칭호(좋은 순). 8강 이하는 칭호가 아니다. */
export function titlesOf(
  honors: readonly { edition: number; stage: CupStage; division?: CupDivision | null }[],
  leagueChampionSeasons: readonly number[] = [],
): OwnerTitle[] {
  return [
    ...honors.flatMap((h) =>
      isTitleStage(h.stage) ? [titleIdOf(h.edition, h.stage, h.division)] : [],
    ),
    ...leagueChampionSeasons.map(leagueTitleIdOf),
  ].sort(compareTitles);
}

/** Shared single-career feats used by seasonal achievements and lifetime title counts. */
export const CAREER_FEATS = { goals: 500, caps: 150, assists: 300, peak: 90 } as const;
export const TITLE_GRADES = ['entry', 'skilled', 'honor', 'legend'] as const;
export type TitleGrade = (typeof TITLE_GRADES)[number];
/** T-11-547 명예관 묶음(화면 순서). 트로피 칭호(컵 · 리그)는 묶음 밖에서 따로 그린다. */
export const TITLE_CATEGORIES = ['growth', 'position', 'record', 'legacy', 'team'] as const;
export type TitleCategory = (typeof TITLE_CATEGORIES)[number];
/** T-11-547 구단주 팀 디비전 칭호의 기준(team-division TEAM_DIVISION_KEYS index — elite2 · master). */
export const TITLE_DIVISION = { elite: 5, master: 7 } as const;

type PermanentTitleDef = {
  id: string;
  metric: string;
  target: number;
  symbol: string;
  grade: TitleGrade;
  category: TitleCategory;
  related: string;
};
const def = <const T extends readonly PermanentTitleDef[]>(t: T) => t;

/**
 * Grades describe challenge depth, not measured rarity. Player milestones count distinct careers; firsts count finalized honors.
 * T-11-547 같은 metric의 칭호는 target 순서로 한 사다리(단계)다. 맨 위 단계는 연결된 구단주의 0.5~3% 안팎을 겨눈다.
 */
export const PERMANENT_TITLES = def([
  // 육성 — 은퇴시킨 선수 수 · 최고 능력치 90 이상 선수 수.
  {
    id: 'owner-developer',
    metric: 'retired',
    target: 10,
    symbol: 'academy',
    grade: 'entry',
    category: 'growth',
    related: 'retire',
  },
  {
    id: 'owner-academy',
    metric: 'retired',
    target: 50,
    symbol: 'academy',
    grade: 'honor',
    category: 'growth',
    related: 'retire',
  },
  {
    id: 'owner-youth-kingdom',
    metric: 'retired',
    target: 100,
    symbol: 'academy',
    grade: 'legend',
    category: 'growth',
    related: 'retire',
  },
  {
    id: 'owner-star-maker',
    metric: 'elite',
    target: 3,
    symbol: 'star',
    grade: 'skilled',
    category: 'growth',
    related: 'retire',
  },
  {
    id: 'owner-star-factory',
    metric: 'elite',
    target: 10,
    symbol: 'star',
    grade: 'honor',
    category: 'growth',
    related: 'retire',
  },
  {
    id: 'owner-star-cradle',
    metric: 'elite',
    target: 30,
    symbol: 'star',
    grade: 'legend',
    category: 'growth',
    related: 'retire',
  },
  // 포지션 — 최고 능력치 90 이상 선수의 포지션.
  {
    id: 'owner-forward',
    metric: 'forwards',
    target: 10,
    symbol: 'ball',
    grade: 'honor',
    category: 'position',
    related: 'retire',
  },
  {
    id: 'owner-midfield',
    metric: 'midfield',
    target: 5,
    symbol: 'pitch',
    grade: 'honor',
    category: 'position',
    related: 'retire',
  },
  {
    id: 'owner-defense',
    metric: 'defense',
    target: 5,
    symbol: 'shield',
    grade: 'honor',
    category: 'position',
    related: 'retire',
  },
  {
    id: 'owner-keeper',
    metric: 'keeper',
    target: 5,
    symbol: 'glove',
    grade: 'legend',
    category: 'position',
    related: 'retire',
  },
  {
    id: 'owner-all-rounder',
    metric: 'positions',
    target: 4,
    symbol: 'pitch',
    grade: 'honor',
    category: 'position',
    related: 'retire',
  },
  // 기록 — 한 커리어의 큰 기록을 낸 선수 수.
  {
    id: 'owner-goals',
    metric: 'scorers',
    target: 5,
    symbol: 'ball',
    grade: 'skilled',
    category: 'record',
    related: 'goals',
  },
  {
    id: 'owner-goal-dynasty',
    metric: 'scorers',
    target: 20,
    symbol: 'ball',
    grade: 'legend',
    category: 'record',
    related: 'goals',
  },
  {
    id: 'owner-assists',
    metric: 'creators',
    target: 5,
    symbol: 'pitch',
    grade: 'honor',
    category: 'record',
    related: 'assists',
  },
  {
    id: 'owner-assist-dynasty',
    metric: 'creators',
    target: 20,
    symbol: 'pitch',
    grade: 'legend',
    category: 'record',
    related: 'assists',
  },
  {
    id: 'owner-national',
    metric: 'internationals',
    target: 5,
    symbol: 'flag',
    grade: 'skilled',
    category: 'record',
    related: 'caps',
  },
  {
    id: 'owner-national-dynasty',
    metric: 'internationals',
    target: 20,
    symbol: 'flag',
    grade: 'legend',
    category: 'record',
    related: 'caps',
  },
  {
    id: 'owner-ballon-maker',
    metric: 'ballon',
    target: 5,
    symbol: 'ball',
    grade: 'honor',
    category: 'record',
    related: 'ballon',
  },
  {
    id: 'owner-ballon-dynasty',
    metric: 'ballon',
    target: 20,
    symbol: 'ball',
    grade: 'legend',
    category: 'record',
    related: 'ballon',
  },
  // 구단 유산 — 프리시즌 · 최초 기록 · 영구결번 · 국적 · 카드 과제.
  {
    id: 'owner-founder',
    metric: 'preseason',
    target: 1,
    symbol: 'flag',
    grade: 'entry',
    category: 'legacy',
    related: 'preseason',
  },
  {
    id: 'owner-pioneer',
    metric: 'firsts',
    target: 1,
    symbol: 'flag',
    grade: 'honor',
    category: 'legacy',
    related: 'firsts',
  },
  {
    id: 'owner-legend-home',
    metric: 'numbers',
    target: 3,
    symbol: 'shirt',
    grade: 'honor',
    category: 'legacy',
    related: 'numbers',
  },
  {
    id: 'owner-dynasty',
    metric: 'numbers',
    target: 25,
    symbol: 'shirt',
    grade: 'legend',
    category: 'legacy',
    related: 'numbers',
  },
  {
    id: 'owner-world',
    metric: 'nations',
    target: 10,
    symbol: 'globe',
    grade: 'skilled',
    category: 'legacy',
    related: 'nations',
  },
  {
    id: 'owner-world-tour',
    metric: 'nations',
    target: 30,
    symbol: 'globe',
    grade: 'legend',
    category: 'legacy',
    related: 'nations',
  },
  // T-11-547 10일 → 5일(과제가 10-24에 열려 아무도 닿지 못했다), 윗 단계 20일.
  {
    id: 'owner-exchange',
    metric: 'exchanges',
    target: 5,
    symbol: 'star',
    grade: 'skilled',
    category: 'legacy',
    related: 'exchange',
  },
  {
    id: 'owner-exchange-master',
    metric: 'exchanges',
    target: 20,
    symbol: 'star',
    grade: 'honor',
    category: 'legacy',
    related: 'exchange',
  },
  // 구단주 팀 — 컵 · 시즌 · 디비전.
  {
    id: 'owner-cup-regular',
    metric: 'cups',
    target: 3,
    symbol: 'trophy',
    grade: 'entry',
    category: 'team',
    related: 'cup',
  },
  {
    id: 'owner-cup-contender',
    metric: 'podiums',
    target: 3,
    symbol: 'trophy',
    grade: 'legend',
    category: 'team',
    related: 'cup',
  },
  {
    id: 'owner-seasons',
    metric: 'seasons',
    target: 3,
    symbol: 'calendar',
    grade: 'skilled',
    category: 'team',
    related: 'seasons',
  },
  {
    id: 'owner-division-elite',
    metric: 'division',
    target: TITLE_DIVISION.elite,
    symbol: 'chevron',
    grade: 'honor',
    category: 'team',
    related: 'division',
  },
  {
    id: 'owner-division-master',
    metric: 'division',
    target: TITLE_DIVISION.master,
    symbol: 'chevron',
    grade: 'legend',
    category: 'team',
    related: 'division',
  },
]);
export type PermanentTitle = (typeof PERMANENT_TITLES)[number];
export type PermanentTitleId = PermanentTitle['id'];
export type TitleMetric = PermanentTitle['metric'];
/** T-11-547 4: 단계 · 새 칭호. 명예관을 열면 이전 버전 진행도를 한 번 다시 센다(받은 칭호는 그대로). */
export const TITLE_CRITERIA_VERSION = 4;
export const permanentTitleOf = (id: string | null | undefined) =>
  PERMANENT_TITLES.find((t) => t.id === id);
export const isOwnerTitle = (id: string): boolean => !!parseTitle(id) || !!permanentTitleOf(id);

/** T-11-547 같은 metric 칭호의 단계(target 순). step은 1부터. */
export function titleLadderOf(id: string) {
  const t = permanentTitleOf(id);
  if (!t) return null;
  const ladder = PERMANENT_TITLES.filter((x) => x.metric === t.metric).sort(
    (a, b) => a.target - b.target,
  );
  return { step: ladder.indexOf(t) + 1, steps: ladder.length, ladder };
}
