import {
  POS,
  ATTR_KEYS,
  LAST_PHASE,
  COND_LOW_START,
  COND_LOW_INJURY,
  scoreRate,
  type AttrKey,
} from './data.js';
import { ovr, wOf } from './attributes.js';
import { clamp, ri, chance, gauss, poisson, rnd } from './rng.js';
import { BAL } from './balance.js';
import type { GameState } from './types.js';
import { leagueOf, roleOf } from './player.js';
import { addAttr, addStat } from './stats.js';
import { growthFactor } from './training.js';
import { matchOpp } from './table.js';
import { gTurnText as L } from './i18n/ko/gTurn.js';
import type { CareerMoment, MomentHooks } from './moments.js';

// ───────── 경기 구간 시뮬레이션 ─────────
export function blockMatches(s: GameState): number {
  return Math.ceil(leagueOf(s.leagueId).matches / LAST_PHASE);
}
export function roundRange(s: GameState, phase: number): string {
  const n = blockMatches(s);
  const tot = leagueOf(s.leagueId).matches;
  const a = (phase - 1) * n + 1;
  const b = Math.min(tot, phase * n);
  return L.roundRange({ a, b });
}

/** 득점·도움 기대값에 들어가는 '리그(상대) 평균 대비 우위'. DOMINANCE_KNEE를 넘는 몫은 DOMINANCE_SLOPE만 반영한다
 * (T-10-039). 보통 커리어에선 우위가 이 기준을 넘는 일이 드물지만, 상무 복무처럼 OVR 90 선수가 평균 63인 K리그1에 들어가면 25를 넘어
 * 기대값이 지수로 불어나 한 시즌 80골이 나왔다 — 압도적인 선수도 경기당 득점에는 한계가 있다.
 * T-10-042부터 공격(창의) 능력치 우위는 더 이른 attackEdge()로 줄이고, 이 함수는 경기력(OVR 우위)에만 쓴다. */
export const DOMINANCE_KNEE = 14;
const DOMINANCE_SLOPE = 0.15;
/** T-10-042: 공격(창의) 능력치 우위는 ATTACK_KNEE부터 ATTACK_SLOPE만 반영한다 — 리그 최정상 공격수도 시즌
 * 경기당 1골 안팎에서 멈추게(시뮬레이션 시즌 경기당 1골 초과 1.3~2% → 0.2~0.4%, 시즌 최다 63골 → 49골). */
export const ATTACK_KNEE = 8;
const ATTACK_SLOPE = 0.3;
/** gap이 knee까지는 그대로, 넘는 몫은 slope배만 반영한다. */
const softKnee = (gap: number, knee: number, slope: number): number =>
  gap <= knee ? gap : knee + (gap - knee) * slope;
export const attackEdge = (gap: number): number => softKnee(gap, ATTACK_KNEE, ATTACK_SLOPE);
export const dominance = (gap: number): number => softKnee(gap, DOMINANCE_KNEE, DOMINANCE_SLOPE);
/** 득점 기대값에 쓰는 공격 능력치(포지션별 가중합). */
export const atkOf = (s: GameState): number =>
  Object.entries(POS[s.pos].atk).reduce(
    (t, [k, w]) => t + s.attrs[k as AttrKey] * (w as number),
    0,
  );
/** T-10-042: 공격수의 도움은 패스·드리블만이 아니라 슈팅·움직임(공격 능력치)에서도 나온다 — 득점원도 시즌 5~10도움. */
export const FW_ATTACK_ASSIST = 0.65;
/** 도움 기대값에 쓰는 창의 능력치. */
export const creOf = (s: GameState): number => {
  const cre = s.attrs.pas * 0.7 + s.attrs.dri * 0.3;
  return s.pos === 'FW' ? cre * (1 - FW_ATTACK_ASSIST) + atkOf(s) * FW_ATTACK_ASSIST : cre;
};
/** 득점·도움 기대값 배수. atk는 공격(또는 창의) 능력치, perf는 경기력(평균 대비 OVR 우위 o - avg를 포함)이다. */
export function scoreBoost(atk: number, o: number, perf: number, avg: number): number {
  return Math.exp(
    attackEdge(atk - avg) / 20 + (perf + (dominance(o - avg) - (o - avg)) / 10) * 0.2,
  );
}

export interface MatchGame {
  rd: number;
  res: 'W' | 'D' | 'L';
  mins: number;
  g?: number;
  a?: number;
  rating?: number;
  cs?: boolean;
  inj?: boolean;
  /** T-11-134 상대 구단 id(옛 시즌은 없다). */
  opp?: string;
  /** T-11-379 평점 구성(뛴 경기만). 화면 설명용이라 세이브에 남지 않는다(BlockResult는 저장하지 않는다). */
  parts?: RatingParts;
}
/**
 * T-11-379 경기 평점을 이룬 몫(반올림 · 상한 전). 경기력(perf × 0.35)은 OVR 우위 · 컨디션 · 사기 · 그날 흐름으로 나눈다.
 * 이미 굴린 값을 그대로 담을 뿐 난수를 더 쓰지 않는다.
 */
export interface RatingParts {
  goals: number;
  assists: number;
  ovrEdge: number;
  cond: number;
  morale: number;
  form: number;
  cs: number;
  def: number;
  result: number;
  luck: number;
}
/** 평점 기본값(모든 몫이 0일 때). */
export const RATING_BASE = 6.2;
/** 경기력이 평점에 들어가는 배율. */
const PERF_RATING_K = 0.35;
export interface BlockResult {
  n: number;
  apps: number;
  goals: number;
  assists: number;
  rs: number;
  w: number;
  d: number;
  l: number;
  cs: number;
  hl: string[];
  injured: boolean;
  games: MatchGame[];
  /** T-11-390 이 구간의 결정적 장면(뛴 경기가 없으면 없다). */
  moment?: CareerMoment;
}
/** 역할별 선발 확률 — 리그 경기와 대륙 대회가 같다(국내 컵은 로테이션을 더 쓴다, comps.ts). */
export const START_P = { 주전: 0.92, 로테이션: 0.5, 벤치: 0.12 } as const;
/** 경기 골·도움을 정하는 선수 전력: 공격력(atkOf)·창의력(creOf)·OVR. */
export interface ScoringPower {
  atk: number;
  cre: number;
  o: number;
}
/** 한 경기 골·도움. 기대값은 포지션 기본값 × 우위 보정 × 출전 비율, 골을 먼저 굴린다(RNG 순서). */
export function rollScoring(
  s: GameState,
  { atk, cre, o }: ScoringPower,
  perf: number,
  oppAvg: number,
  mins: number,
): { g: number; a: number; lg: number; la: number } {
  const P = scoreRate(s);
  const lg = P.goal * scoreBoost(atk, o, perf, oppAvg) * (mins / 90);
  const la = P.assist * scoreBoost(cre, o, perf, oppAvg) * (mins / 90);
  const g = poisson(lg);
  const a = poisson(la);
  return { g, a, lg, la };
}
type Res = 'W' | 'D' | 'L';
const isKeeperLine = (s: GameState) => s.pos === 'DF' || s.pos === 'GK';

/** 한 경기 출전 시간(부상 중이면 0). 선발이면 18% 확률로 교체 아웃, 아니면 교체 투입을 굴린다. */
function rollMinutes(s: GameState, startP: number, subP: number): { mins: number; inj: boolean } {
  const inj = s.injury > 0;
  if (inj) {
    s.injury--;
    return { mins: 0, inj };
  }
  const sp = startP * (s.cond < COND_LOW_START ? 0.6 : 1);
  if (chance(sp)) {
    s.season.starts++;
    return { mins: chance(0.18) ? ri(60, 85) : 90, inj };
  }
  return { mins: chance(subP) ? ri(8, 35) : 0, inj };
}

/** 팀 결과 확률. 구단 전력과 상대 전력(oppStr, 옛 시즌은 리그 평균) 차이가 바탕이고, 출전했으면 내 경기력·골이 승률을 조금 올린다. */
function resultOdds(
  s: GameState,
  oppStr: number,
  mins: number,
  perf: number,
  g: number,
): { wp: number; dp: number } {
  const wp = clamp(
    0.38 + (s.club.str - oppStr) * 0.024 + (mins ? perf * 0.035 + g * 0.12 : 0),
    0.07,
    0.88,
  );
  return { wp, dp: (1 - wp) * 0.38 };
}
/** 결과 난수 x를 승 · 무 · 패로(shift는 결정적 장면이 옮긴 기준선). */
const resOf = (x: number, { wp, dp }: { wp: number; dp: number }, shift = 0): Res =>
  x < wp + shift ? 'W' : x < wp + dp + shift ? 'D' : 'L';

/** 경기력을 이룬 몫(simBlock이 더한 순서 그대로 — 합이 perf와 비트까지 같다). */
interface PerfParts {
  ovrEdge: number;
  form: number;
  cond: number;
  morale: number;
}

/** 경기 평점(4.5~10, 0.1 단위)과 그 구성. 식 · 난수 순서는 T-11-379 전과 같다. */
function rateMatch(
  s: GameState,
  avg: number,
  m: { g: number; a: number; perf: number; pp: PerfParts; cs: boolean; res: Res },
): { rating: number; parts: RatingParts } {
  const cs = m.cs ? 0.45 : 0;
  const keeper = isKeeperLine(s) ? (s.attrs.def - avg) / 25 : 0;
  // T-10-091 수비형 미드필더는 수비 기여를 평점에 절반만큼 받는다(골·도움이 적은 몫).
  const dm = s.dpos === 'DM' ? (s.attrs.def - avg) / 50 : 0;
  const result = m.res === 'W' ? 0.2 : m.res === 'L' ? -0.2 : 0;
  const luck = gauss() * 0.25;
  const rating =
    RATING_BASE + m.g * 0.9 + m.a * 0.5 + m.perf * PERF_RATING_K + cs + keeper + dm + result + luck;
  return {
    rating: clamp(Math.round(rating * 10) / 10, 4.5, 10),
    parts: {
      goals: m.g * 0.9,
      assists: m.a * 0.5,
      ovrEdge: m.pp.ovrEdge * PERF_RATING_K,
      cond: m.pp.cond * PERF_RATING_K,
      morale: m.pp.morale * PERF_RATING_K,
      form: m.pp.form * PERF_RATING_K,
      cs,
      def: keeper + dm,
      result,
      luck,
    },
  };
}

/**
 * T-11-379 성장 방향(표시만, 난수 · 상태를 건드리지 않는다). 골키퍼 · 수비수는 평점에 더해지는 수비 능력치,
 * 그 밖에는 골(공격수) 또는 도움(미드필더)을 정하는 능력치 가중합에서 가장 크게 쓰이는 능력치와 리그 평균과의 차이.
 * knee는 공격(창의) 능력치가 리그 평균보다 ATTACK_KNEE 넘게 높아 더 올려도 조금씩만 늘어나는 구간이다.
 */
export type GrowthDirection =
  | { kind: 'def'; gap: number }
  | { kind: 'goal' | 'assist'; attr: AttrKey; pct: number; gap: number; knee: boolean };
export function growthDirection(s: GameState): GrowthDirection {
  const avg = leagueOf(s.leagueId).avg;
  if (isKeeperLine(s)) return { kind: 'def', gap: s.attrs.def - avg };
  const goal = s.pos === 'FW';
  // 미드필더의 도움은 창의 능력치(패스 0.7 · 드리블 0.3, creOf)로 정해진다.
  const w: Partial<Record<AttrKey, number>> = goal ? POS[s.pos].atk : { pas: 0.7, dri: 0.3 };
  const top = (Object.entries(w) as [AttrKey, number][]).sort(
    (a, b) => b[1] - a[1] || ATTR_KEYS.indexOf(a[0]) - ATTR_KEYS.indexOf(b[0]),
  )[0]!;
  const power = goal ? atkOf(s) : creOf(s);
  return {
    kind: goal ? 'goal' : 'assist',
    attr: top[0],
    pct: Math.round(top[1] * 100),
    gap: s.attrs[top[0]] - avg,
    knee: power - avg > ATTACK_KNEE,
  };
}

/** 그 경기의 하이라이트 줄(해트트릭·멀티골·MOM·GK 슈퍼 세이브). */
function matchHighlights(
  s: GameState,
  rd: number,
  g: number,
  rating: number,
  cs: boolean,
): string[] {
  const hl: string[] = [];
  if (g >= 3) hl.push(L.hlHat({ rd, g, rating }));
  else if (g === 2) hl.push(L.hlMulti({ rd, rating }));
  else if (rating >= 8.5) hl.push(L.hlMom({ rd, rating }));
  if (cs && s.pos === 'GK' && rating >= 8) hl.push(L.hlSave({ rd, rating }));
  return hl;
}

/** 경기 중 부상. 다쳤으면 결장 경기 수를 정하고 하이라이트 줄을 돌려준다. */
function rollInjury(s: GameState, rd: number): string | null {
  const ip =
    BAL.injuryRate *
    (s.cond < COND_LOW_INJURY ? 2.5 : 1) *
    (s.trait === 'iron' ? 0.35 : 1) *
    (s.age >= 31 ? 1.4 : 1);
  if (!chance(ip)) return null;
  const big = chance(BAL.bigInjuryShare);
  s.injury = big ? ri(8, 18) : ri(1, 5);
  return L.hlInjury({ rd, big, n: s.injury });
}

/** 구간을 마친 뒤: 출전 비율만큼 성장, 활약에 따라 명성·사기·감독 신뢰, 연봉 지급. */
function afterBlock(s: GameState, r: BlockResult, tier: number) {
  const g = growthFactor(s);
  if (r.apps)
    for (const k of ATTR_KEYS) if (chance(wOf(s)[k] * 2)) addAttr(s, k, rnd() * g * (r.apps / r.n));
  const avg = r.apps ? r.rs / r.apps : 0;
  const tierF = (tier + 1) / 4;
  if (r.apps) {
    addStat(s, 'fame', (r.goals * 0.5 + r.assists * 0.25 + Math.max(0, avg - 6.6) * 2) * tierF);
    addStat(s, 'morale', (avg - 6.7) * 6 + (r.w - r.l) / 2);
    if (avg >= 7.1) addStat(s, 'trust', 1.2);
    else if (avg < 6.3) addStat(s, 'trust', -1);
  } else addStat(s, 'morale', -4);
  if (s.contract) addStat(s, 'money', s.contract.salary / LAST_PHASE);
}

/** 리그 한 구간(여러 경기)을 치른다. 경기마다 출전 → 골·도움 → 팀 결과 → 무실점 → 평점 → 부상 순으로 굴린다(RNG 순서). */
export function simBlock(s: GameState, mo?: MomentHooks): BlockResult {
  const L = leagueOf(s.leagueId),
    S = s.season;
  const n =
    s.phase >= LAST_PHASE ? L.matches - S.played : Math.min(blockMatches(s), L.matches - S.played);
  const role = roleOf(s),
    o = ovr(s);
  const r: BlockResult = {
    n,
    apps: 0,
    goals: 0,
    assists: 0,
    rs: 0,
    w: 0,
    d: 0,
    l: 0,
    cs: 0,
    hl: [],
    injured: false,
    games: [],
  };
  const startP = START_P[role];
  const subP = { 주전: 0.05, 로테이션: 0.35, 벤치: 0.38 }[role];
  const power: ScoringPower = { atk: atkOf(s), cre: creOf(s), o };
  let moment: CareerMoment | undefined;
  const at = () => ({ game: r.games.length, rd: S.played });
  for (let i = 0; i < n; i++) {
    S.played++;
    const { mins, inj } = rollMinutes(s, startP, subP);
    let perf = 0,
      g = 0,
      a = 0,
      cs = false;
    const pp: PerfParts = { ovrEdge: 0, form: 0, cond: 0, morale: 0 };
    if (mins > 0) {
      pp.ovrEdge = (o - L.avg) / 10;
      pp.form = gauss() * 0.8;
      pp.cond = (s.cond - 70) / 60;
      pp.morale = (s.morale - 60) / 90;
      perf = pp.ovrEdge + pp.form + pp.cond + pp.morale;
      let lg: number, la: number;
      ({ g, a, lg, la } = rollScoring(s, power, perf, L.avg, mins));
      // T-11-390 찬스 장면: 이 경기 골(미드필더는 골 · 도움)이 났는지에 묶은 장면 난수 u를 성공 기준선과 비교한다.
      if (mo && !moment && !isKeeperLine(s) && mo.due(i, n))
        ({ moment, g, a } = mo.chance(at(), lg, la, g, a));
    }
    // T-11-134 이번 라운드 상대 구단의 시즌 전력. 상대가 정해지지 않은 옛 시즌은 리그 평균 팀을 상대한다.
    const opp = matchOpp(s, S.played, L);
    const oppTag = opp ? { opp: opp.id } : {};
    const oppStr = opp?.str ?? L.avg;
    const odds = resultOdds(s, oppStr, mins, perf, g);
    const x = rnd();
    let res = resOf(x, odds);
    if (mins > 0) {
      // 무실점 난수는 맡겼을 때의 결과로 굴린다(위기 장면이 결과를 바꿔도 난수 수가 같게).
      if (
        isKeeperLine(s) &&
        res !== 'L' &&
        chance(0.32 + (s.club.str - oppStr) * 0.015 + (s.attrs.def - L.avg) * 0.006)
      )
        cs = true;
      // T-11-390 위기 장면: 결과 난수 x를 '지지 않을' 기준선(승 + 무)과 비교한다. 고른 선택지는 기준선만 옮긴다.
      if (mo && !moment && isKeeperLine(s) && mo.due(i, n)) {
        moment = mo.open(at(), odds.wp + odds.dp);
        res = resOf(x, odds, moment.pct - moment.base);
        if (!(moment.ok = res !== 'L')) cs = false;
      }
      if (cs) {
        r.cs++;
        S.cs++;
      }
    }
    const k = res === 'W' ? 'w' : res === 'D' ? 'd' : 'l';
    S[k] = (S[k] ?? 0) + 1;
    r[k] = (r[k] ?? 0) + 1;
    S.pts += res === 'W' ? 3 : res === 'D' ? 1 : 0;
    if (mins > 0) {
      const { rating, parts } = rateMatch(s, L.avg, { g, a, perf, pp, cs, res });
      S.apps++;
      S.mins += mins;
      S.goals += g;
      S.assists += a;
      S.ratingSum += rating;
      r.apps++;
      r.goals += g;
      r.assists += a;
      r.rs += rating;
      r.hl.push(...matchHighlights(s, S.played, g, rating, cs));
      addStat(s, 'cond', -(mins / 90) * 3.2);
      r.games.push({ rd: S.played, res, mins, g, a, rating, cs, ...oppTag, parts });
      const hurt = rollInjury(s, S.played);
      if (hurt) {
        r.injured = true;
        r.hl.push(hurt);
      }
    }
    if (!mins) r.games.push({ rd: S.played, res, mins: 0, inj, ...oppTag });
    addStat(s, 'cond', 1.1);
  }
  if (moment) r.moment = moment;
  afterBlock(s, r, L.tier);
  return r;
}
