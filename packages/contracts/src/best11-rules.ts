/**
 * T-11-463 시즌 BEST 11 선정 규칙. zod가 없는 서브패스(`@offside/contracts/best11-rules`)라 서버 · 웹 · 앱이 같은 식을 쓴다.
 * 설계는 docs/tracking/season-best11-design.md(시즌 1 운영 데이터로 검증한 식 그대로).
 *
 * 1. 커리어마다 받아 둔 시즌 기록으로 세 기둥 원점수를 매긴다(`best11Raw`). 은퇴 때 한 번 계산해 서버에 둔다.
 * 2. 자리마다 후보의 기둥을 그 자리 1위 = 100으로 바꿔 지수를 만든다(`slotRanking`). 개인 50 · 팀 30 · 수상 20.
 * 3. 지수 높은 (자리, 후보) 순으로 채우되 한 커리어 · 한 구단주는 한 자리만(`pickBest11`).
 */
import { LEAGUE_BASE } from './club-names.js';
import type { DetailPos } from './positions.js';

/** 4-3-3 자리(그라운드 순서: 골키퍼 → 수비 → 미드필더 → 공격). `FORMATIONS['4-3-3']`과 같은 순서다. */
export const BEST11_SLOTS = [
  'GK',
  'LB',
  'CB1',
  'CB2',
  'RB',
  'DM',
  'CM',
  'AM',
  'LW',
  'ST',
  'RW',
] as const;
export type Best11Slot = (typeof BEST11_SLOTS)[number];

/** 자리마다 들어갈 수 있는 세부 포지션. FB · W(예전 통합 포지션)는 좌우 양쪽 후보다. */
export const BEST11_SLOT_DPOS: Record<Best11Slot, readonly DetailPos[]> = {
  GK: ['GK'],
  LB: ['LB', 'LWB', 'FB'],
  CB1: ['CB', 'SW'],
  CB2: ['CB', 'SW'],
  RB: ['RB', 'RWB', 'FB'],
  DM: ['DM'],
  CM: ['CM'],
  AM: ['AM'],
  LW: ['LW', 'LM', 'W'],
  ST: ['ST', 'CF', 'SS'],
  RW: ['RW', 'RM', 'W'],
};

/** 그라운드에 그릴 때 자리의 세부 포지션 이름(카드 위 글자). */
export const BEST11_SLOT_ROLE: Record<Best11Slot, DetailPos> = {
  GK: 'GK',
  LB: 'LB',
  CB1: 'CB',
  CB2: 'CB',
  RB: 'RB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LW: 'LW',
  ST: 'ST',
  RW: 'RW',
};

/** 세부 포지션이 들어가는 자리(CB2는 CB1과 같은 후보군이라 순위표에서는 CB1 하나로 본다). */
export const slotsOfDpos = (dpos: DetailPos): Best11Slot[] =>
  BEST11_SLOTS.filter((s) => BEST11_SLOT_DPOS[s].includes(dpos));

/** 세 기둥 비중(개인 활약 · 팀 성과 · 개인 수상). */
export const BEST11_WEIGHTS = [0.5, 0.3, 0.2] as const;
/** 자격: 프로 경기 수 하한과 20경기 이상 뛴 프로 시즌 수 하한. */
export const BEST11_MIN_PRO_APPS = 300;
export const BEST11_MIN_PRIME_SEASONS = 5;
const PRIME_APPS = 20;
const PRIME_COUNT = 5;
/** 자리마다 순위표에 남겨 둘 후보 수(한 구단주 한 자리로 밀려 내려가도 넉넉하게). */
export const BEST11_POOL = 40;
/** 화면에 보여 주는 자리별 순위 수. */
export const BEST11_TOP = 10;
/**
 * T-11-463b 시즌이 확정되면 11자리 주인 구단주에게 한 번 주는 보상. 서버 전체 11명이라 컵 4강(리롤 7 · 스카우트 1 · 강화 1)보다
 * 많고 준우승(10 · 2 · 2)과 같다. 한 구단주는 한 자리만 차지하므로 한 사람이 겹쳐 받지 않는다.
 */
export const BEST11_REWARD = { rerolls: 10, scouts: 2, boosts: 2 } as const;

const TIER = new Map(LEAGUE_BASE.map((l) => [l.name, l.amateur ? -1 : l.tier]));
/** 리그 등급별 무게(프리미어리그 6). 개인 활약 보정은 이 값 / 6, 리그 우승 점수는 이 값 그대로다. */
const LEAGUE_W = [0.5, 1, 1.5, 2, 3, 4, 5, 5.5, 6] as const;
const leagueW = (league: string) => {
  const t = TIER.get(league);
  return t === undefined || t < 0 ? 0 : LEAGUE_W[t]!;
};
const isPro = (league: string) => (TIER.get(league) ?? 0) >= 0;

const SCORER = /득점왕|골든부트|피치치|카포칸노니에레|토르예거카논|게르트 뮐러|골든슈/; // i18n-ignore: 저장된 수상 · 리그 이름
type Group = 'GK' | 'DEF' | 'MID' | 'W' | 'FW';
const POS_AWARD: Record<Group, RegExp> = {
  GK: /야신 트로피|올해의 골키퍼/, // i18n-ignore: 저장된 수상 · 리그 이름
  DEF: /올해의 수비수/, // i18n-ignore: 저장된 수상 · 리그 이름
  MID: /올해의 미드필더|도움왕/, // i18n-ignore: 저장된 수상 · 리그 이름
  W: new RegExp(`${SCORER.source}|도움왕`), // i18n-ignore: 저장된 수상 · 리그 이름
  FW: SCORER,
};
const DEF = new Set<DetailPos>(['CB', 'SW', 'LB', 'RB', 'LWB', 'RWB', 'FB']);
const MID = new Set<DetailPos>(['DM', 'CM', 'AM', 'LM', 'RM']);
const WING = new Set<DetailPos>(['LW', 'RW', 'W']);
const groupOf = (d: DetailPos): Group =>
  d === 'GK' ? 'GK' : DEF.has(d) ? 'DEF' : MID.has(d) ? 'MID' : WING.has(d) ? 'W' : 'FW';

const isTeamHonor = (h: string) => h.endsWith('우승') || h.endsWith('메달'); // i18n-ignore: 저장된 수상 · 리그 이름

/** 팀 성과 점수(우승 · 메달 한 개). */
export function teamPoints(h: string): number {
  if (!isTeamHonor(h)) return 0;
  if (h === 'FIFA 월드컵 우승') return 12; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/아시안컵|유로|코파 아메리카|네이션스컵|골드컵/.test(h)) return 6; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '올림픽 금메달') return 4; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '올림픽 은메달') return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '올림픽 동메달') return 1; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '아시안게임 금메달') return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'UEFA 챔피언스리그 우승') return 8; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '코파 리베르타도레스 우승') return 6; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/챔피언스리그 엘리트 우승|AFC 챔피언스리그 우승/.test(h)) return 4; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'FIFA 클럽 월드컵 우승') return 4; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'UEFA 유로파리그 우승') return 4; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/컨퍼런스리그|챔피언스리그 2 우승/.test(h)) return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/고교|대학|전국/.test(h)) return 0; // i18n-ignore: 저장된 수상 · 리그 이름
  const league = h.slice(0, -3);
  if (TIER.has(league)) return leagueW(league);
  return 1; // 국내 컵 · 슈퍼컵
}

/** 개인 수상 점수(수상 한 개, 자기 포지션 상은 2배 전). */
export function awardPoints(h: string): number {
  if (isTeamHonor(h)) return 0;
  if (h === '발롱도르') return 10; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'FIFA 더 베스트 남자 선수') return 6; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'UEFA 올해의 선수') return 5; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === 'FIFPRO 월드 11') return 3; // i18n-ignore: 저장된 수상 · 리그 이름
  if (h === '야신 트로피') return 4; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/축구협회 올해의 선수/.test(h)) return 1; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/^(AFC|남미|아프리카|CONCACAF)/.test(h)) return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/올해의 선수|MVP|PFA/.test(h)) return h.startsWith('대회') ? 1 : 3; // i18n-ignore: 저장된 수상 · 리그 이름
  if (SCORER.test(h) || h.includes('도움왕')) return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/올해의 (미드필더|수비수|골키퍼)/.test(h)) return 2; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/올해의 팀|베스트 11/.test(h)) return h.startsWith('대회') ? 0.5 : 1.5; // i18n-ignore: 저장된 수상 · 리그 이름
  if (/영플레이어|코파 트로피/.test(h)) return 1; // i18n-ignore: 저장된 수상 · 리그 이름
  return 0.5;
}

/** 시즌 기록 한 줄(서버 career_seasons · 기기 시즌 기록 어느 쪽이든). */
export interface Best11Season {
  league: string;
  apps: number;
  goals: number;
  assists: number;
  cs: number | null;
  rating: number;
  honors: readonly string[];
}

/** 은퇴 때 한 번 매겨 두는 원점수와 화면에 보일 근거(선정 이유). */
export interface Best11Raw {
  /** 전성기 5시즌 보정 평점 평균. */
  rating: number;
  /** 전성기 5시즌 보정 경기당 골 · 도움 · 무실점. */
  goals: number;
  assists: number;
  cs: number;
  /** 팀 성과 · 개인 수상 원점수. */
  team: number;
  award: number;
  /** 근거: 보정 전 전성기 평점, 프로 경기, 리그 우승 · 챔스 · 월드컵 · 발롱도르 · FIFPRO · 자기 포지션 상 횟수. */
  rawRating: number;
  apps: number;
  leagues: number;
  ucl: number;
  wc: number;
  ballon: number;
  fifpro: number;
  posAwards: number;
}

/** 자격을 갖췄으면 원점수, 아니면 null. */
export function best11Raw(dpos: DetailPos, seasons: readonly Best11Season[]): Best11Raw | null {
  const pro = seasons.filter((s) => isPro(s.league));
  const apps = pro.reduce((n, s) => n + s.apps, 0);
  const primeable = pro.filter((s) => s.apps >= PRIME_APPS);
  if (apps < BEST11_MIN_PRO_APPS || primeable.length < BEST11_MIN_PRIME_SEASONS) return null;
  // 리그 수준 보정: (평점 − 6)과 기록에 리그 무게 / 6(프리미어리그 1)을 곱한다. 약한 리그의 높은 평점이 앞서지 않게.
  const lf = (s: Best11Season) => leagueW(s.league) / 6;
  const adj = (s: Best11Season) => 6 + (s.rating - 6) * lf(s);
  const prime = [...primeable].sort((a, b) => adj(b) - adj(a)).slice(0, PRIME_COUNT);
  const t = prime.reduce(
    (x, s) => ({
      a: x.a + s.apps,
      g: x.g + s.goals * lf(s),
      s: x.s + s.assists * lf(s),
      c: x.c + (s.cs ?? 0) * lf(s),
      r: x.r + adj(s),
      rr: x.rr + s.rating,
    }),
    { a: 0, g: 0, s: 0, c: 0, r: 0, rr: 0 },
  );
  const posAward = POS_AWARD[groupOf(dpos)];
  let team = 0;
  let award = 0;
  const n = { leagues: 0, ucl: 0, wc: 0, ballon: 0, fifpro: 0, posAwards: 0 };
  for (const s of seasons) {
    for (const h of s.honors) {
      team += teamPoints(h);
      const lg = h.endsWith(' 우승') ? h.slice(0, -3) : ''; // i18n-ignore: 저장된 수상 · 리그 이름
      if (lg && (TIER.get(lg) ?? -1) >= 0) n.leagues++;
      if (h === 'UEFA 챔피언스리그 우승') n.ucl++; // i18n-ignore: 저장된 수상 · 리그 이름
      if (h === 'FIFA 월드컵 우승') n.wc++; // i18n-ignore: 저장된 수상 · 리그 이름
      if (h === '발롱도르') n.ballon++; // i18n-ignore: 저장된 수상 · 리그 이름
      if (h === 'FIFPRO 월드 11') n.fifpro++; // i18n-ignore: 저장된 수상 · 리그 이름
      if (posAward.test(h)) n.posAwards++;
    }
    // 시즌마다 무게 큰 수상 3개까지(레전드 점수의 시즌당 3개 상한과 같다). 자기 포지션 상은 2배.
    award += s.honors
      .map((h) => awardPoints(h) * (posAward.test(h) ? 2 : 1))
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((x, y) => x + y, 0);
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const r4 = (v: number) => Math.round(v * 10_000) / 10_000;
  return {
    rating: r4(t.r / PRIME_COUNT),
    goals: r4(t.g / t.a),
    assists: r4(t.s / t.a),
    cs: r4(t.c / t.a),
    team: r2(team),
    award: r2(award),
    rawRating: r2(t.rr / PRIME_COUNT),
    apps,
    ...n,
  };
}

/** 자리 순위에 쓰는 후보(서버가 담아 둔 행). */
export interface Best11Candidate {
  careerId: string;
  /** 같은 구단주 판정용(화면에는 내보내지 않는다). */
  ownerId: string;
  dpos: DetailPos;
  retiredAt: string;
  raw: Best11Raw;
}

export interface Best11Scored<C extends Best11Candidate = Best11Candidate> {
  c: C;
  /** 세 기둥(자리 1위 = 100)과 지수. */
  ind: number;
  team: number;
  award: number;
  index: number;
}

const FULLBACK = new Set<DetailPos>(['LB', 'RB', 'LWB', 'RWB', 'FB']);
/** 포지션 핵심 기록(경기당). 풀백은 무실점 · 도움 반반이라 따로 정규화한다. */
function keyStat(d: DetailPos, r: Best11Raw): number {
  if (d === 'GK' || d === 'CB' || d === 'SW') return r.cs;
  if (d === 'DM' || d === 'CM') return r.assists;
  if (d === 'ST' || d === 'CF' || d === 'SS') return r.goals;
  return r.goals + r.assists;
}

const safeMax = (xs: number[]) => Math.max(1e-9, ...xs);

/** 자리 정규화 기준: 후보군의 각 기둥 · 핵심 기록 최댓값. */
export interface Best11Norm {
  cs: number;
  assists: number;
  key: number;
  rating: number;
  team: number;
  award: number;
}

const keyWith = (n: Pick<Best11Norm, 'cs' | 'assists'>, d: DetailPos, r: Best11Raw) =>
  FULLBACK.has(d) ? (0.5 * r.cs) / n.cs + (0.5 * r.assists) / n.assists : keyStat(d, r);

function slotNorm(pool: readonly Best11Candidate[]): Best11Norm {
  const base = {
    cs: safeMax(pool.map((c) => c.raw.cs)),
    assists: safeMax(pool.map((c) => c.raw.assists)),
  };
  return {
    ...base,
    key: safeMax(pool.map((c) => keyWith(base, c.dpos, c.raw))),
    rating: safeMax(pool.map((c) => c.raw.rating - 6)),
    team: safeMax(pool.map((c) => c.raw.team)),
    award: safeMax(pool.map((c) => c.raw.award)),
  };
}

function scoreWith(n: Best11Norm, d: DetailPos, r: Best11Raw) {
  const ind =
    100 * (0.6 * (Math.max(0, r.rating - 6) / n.rating) + 0.4 * (keyWith(n, d, r) / n.key));
  const team = (100 * r.team) / n.team;
  const award = (100 * r.award) / n.award;
  const [wi, wt, wa] = BEST11_WEIGHTS;
  return { ind, team, award, index: wi * ind + wt * team + wa * award };
}

const inSlot = (slot: Best11Slot) => (c: Best11Candidate) =>
  BEST11_SLOT_DPOS[slot].includes(c.dpos);

/** 한 자리의 순위(지수 높은 순, 동점은 개인 활약 → 개인 수상 → 먼저 은퇴). */
export function slotRanking<C extends Best11Candidate>(
  slot: Best11Slot,
  candidates: readonly C[],
): Best11Scored<C>[] {
  const pool = candidates.filter(inSlot(slot));
  if (!pool.length) return [];
  const norm = slotNorm(pool);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return pool
    .map((c) => ({ c, ...scoreWith(norm, c.dpos, c.raw) }))
    .sort(
      (a, b) =>
        b.index - a.index ||
        b.ind - a.ind ||
        b.award - a.award ||
        a.c.retiredAt.localeCompare(b.c.retiredAt),
    )
    .map((s) => ({
      ...s,
      ind: r1(s.ind),
      team: r1(s.team),
      award: r1(s.award),
      index: r1(s.index),
    }));
}

/** 자리마다 은퇴를 거르는 기준: 정규화 최댓값과 남겨 둔 후보의 마지막 지수(후보가 BEST11_POOL명보다 적으면 0). */
export type Best11Gate = Partial<Record<Best11Slot, Best11Norm & { floor: number }>>;

export function best11Gate(candidates: readonly Best11Candidate[]): Best11Gate {
  const out: Best11Gate = {};
  for (const slot of BEST11_SLOTS) {
    const pool = candidates.filter(inSlot(slot));
    if (!pool.length) continue;
    const ranked = slotRanking(slot, pool);
    out[slot] = {
      ...slotNorm(pool),
      floor: ranked.length < BEST11_POOL ? 0 : ranked[BEST11_POOL - 1]!.index,
    };
  }
  return out;
}

/**
 * 새 은퇴가 순위를 바꿀 수 있는가: 후보가 비었거나, 어느 기준 최댓값을 넘거나, 커트라인 이상인 자리가 하나라도 있으면 true.
 * false면 후보에 넣지 않는다(은퇴마다 후보 수백 줄을 다시 읽지 않게).
 */
export function best11Admits(gate: Best11Gate | null, dpos: DetailPos, raw: Best11Raw): boolean {
  if (!gate) return true;
  return slotsOfDpos(dpos).some((slot) => {
    const g = gate[slot];
    if (!g || g.floor === 0) return true;
    const key = keyWith(g, dpos, raw);
    if (
      raw.cs > g.cs ||
      raw.assists > g.assists ||
      key > g.key ||
      raw.rating - 6 > g.rating ||
      raw.team > g.team ||
      raw.award > g.award
    )
      return true;
    return scoreWith(g, dpos, raw).index >= g.floor;
  });
}

export type Best11Pick<C extends Best11Candidate = Best11Candidate> = Record<
  Best11Slot,
  Best11Scored<C> | null
>;

/** 자리별 순위로 11자리를 채운다. 한 커리어 · 한 구단주는 가장 지수가 높은 자리 하나만. */
export function pickBest11<C extends Best11Candidate>(
  rankings: Record<Best11Slot, readonly Best11Scored<C>[]>,
): Best11Pick<C> {
  const all = BEST11_SLOTS.flatMap((slot) => rankings[slot].map((s) => ({ slot, s })));
  all.sort((a, b) => b.s.index - a.s.index || b.s.ind - a.s.ind || b.s.award - a.s.award);
  const out = Object.fromEntries(BEST11_SLOTS.map((s) => [s, null])) as Best11Pick<C>;
  const owners = new Set<string>();
  const careers = new Set<string>();
  for (const { slot, s } of all) {
    if (out[slot] || owners.has(s.c.ownerId) || careers.has(s.c.careerId)) continue;
    out[slot] = s;
    owners.add(s.c.ownerId);
    careers.add(s.c.careerId);
  }
  return out;
}

/** 후보 전체로 자리별 순위와 BEST 11을 한 번에. */
export function rankBest11<C extends Best11Candidate>(candidates: readonly C[]) {
  const rankings = Object.fromEntries(
    BEST11_SLOTS.map((slot) => [slot, slotRanking(slot, candidates)]),
  ) as Record<Best11Slot, Best11Scored<C>[]>;
  return { rankings, pick: pickBest11(rankings) };
}

/**
 * 서버에 남겨 둘 후보: 자리마다 지수 상위 BEST11_POOL명과, 정규화 기준(각 기둥 · 핵심 기록 1위)이 되는 후보.
 * 기준이 되는 후보를 지우지 않으므로 줄인 뒤에도 남은 후보의 지수가 그대로다.
 */
export function best11Keep<C extends Best11Candidate>(candidates: readonly C[]): Set<string> {
  const keep = new Set<string>();
  for (const slot of BEST11_SLOTS) {
    const pool = candidates.filter(inSlot(slot));
    if (!pool.length) continue;
    for (const s of slotRanking(slot, pool).slice(0, BEST11_POOL)) keep.add(s.c.careerId);
    const norm = slotNorm(pool);
    const dims: ((c: C) => number)[] = [
      (c) => c.raw.cs,
      (c) => c.raw.assists,
      (c) => keyWith(norm, c.dpos, c.raw),
      (c) => c.raw.rating,
      (c) => c.raw.team,
      (c) => c.raw.award,
    ];
    for (const f of dims) {
      let best = pool[0]!;
      for (const c of pool) if (f(c) > f(best)) best = c;
      keep.add(best.careerId);
    }
  }
  return keep;
}
