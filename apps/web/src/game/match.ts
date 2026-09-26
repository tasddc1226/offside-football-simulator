import { POS, ATTR_KEYS, LAST_PHASE, type AttrKey } from './data.js';
import { ovr, wOf } from './attributes.js';
import { clamp, ri, chance, gauss, poisson, rnd } from './rng.js';
import { BAL } from './balance.js';
import type { GameState } from './types.js';
import { leagueOf, roleOf } from './player.js';
import { addAttr, addStat } from './stats.js';
import { growthFactor } from './training.js';

// ───────── 경기 구간 시뮬레이션 ─────────
export function blockMatches(s: GameState): number {
  return Math.ceil(leagueOf(s.leagueId).matches / LAST_PHASE);
}
export function roundRange(s: GameState, phase: number): string {
  const n = blockMatches(s);
  const tot = leagueOf(s.leagueId).matches;
  const a = (phase - 1) * n + 1;
  const b = Math.min(tot, phase * n);
  return `${a}–${b}R`;
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
const softKnee = (gap: number, knee: number, slope: number): number => (gap <= knee ? gap : knee + (gap - knee) * slope);
export const attackEdge = (gap: number): number => softKnee(gap, ATTACK_KNEE, ATTACK_SLOPE);
export const dominance = (gap: number): number => softKnee(gap, DOMINANCE_KNEE, DOMINANCE_SLOPE);
/** 득점 기대값에 쓰는 공격 능력치(포지션별 가중합). */
export const atkOf = (s: GameState): number => Object.entries(POS[s.pos].atk).reduce((t, [k, w]) => t + s.attrs[k as AttrKey] * (w as number), 0);
/** T-10-042: 공격수의 도움은 패스·드리블만이 아니라 슈팅·움직임(공격 능력치)에서도 나온다 — 득점원도 시즌 5~10도움. */
export const FW_ATTACK_ASSIST = 0.65;
/** 도움 기대값에 쓰는 창의 능력치. */
export const creOf = (s: GameState): number => {
  const cre = s.attrs.pas * 0.7 + s.attrs.dri * 0.3;
  return s.pos === 'FW' ? cre * (1 - FW_ATTACK_ASSIST) + atkOf(s) * FW_ATTACK_ASSIST : cre;
};
/** 득점·도움 기대값 배수. atk는 공격(또는 창의) 능력치, perf는 경기력(평균 대비 OVR 우위 o - avg를 포함)이다. */
export function scoreBoost(atk: number, o: number, perf: number, avg: number): number {
  return Math.exp(attackEdge(atk - avg) / 20 + (perf + (dominance(o - avg) - (o - avg)) / 10) * 0.2);
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
}
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
}
/** 역할별 선발 확률 — 리그 경기와 대륙 대회가 같다(국내 컵은 로테이션을 더 쓴다, comps.ts). */
export const START_P = { 주전: 0.92, 로테이션: 0.5, 벤치: 0.12 } as const;
/** 한 경기 골·도움. 기대값은 포지션 기본값 × 우위 보정 × 출전 비율, 골을 먼저 굴린다(RNG 순서). */
export function rollScoring(s: GameState, atk: number, cre: number, o: number, perf: number, oppAvg: number, mins: number): { g: number; a: number } {
  const P = POS[s.pos];
  const g = poisson(P.goal * scoreBoost(atk, o, perf, oppAvg) * (mins / 90));
  const a = poisson(P.assist * scoreBoost(cre, o, perf, oppAvg) * (mins / 90));
  return { g, a };
}
export function simBlock(s: GameState): BlockResult {
  const L = leagueOf(s.leagueId), S = s.season;
  const n = s.phase >= LAST_PHASE ? L.matches - S.played : Math.min(blockMatches(s), L.matches - S.played);
  const role = roleOf(s), o = ovr(s);
  const r: BlockResult = { n, apps: 0, goals: 0, assists: 0, rs: 0, w: 0, d: 0, l: 0, cs: 0, hl: [], injured: false, games: [] };
  const startP = START_P[role];
  const subP = { 주전: 0.05, 로테이션: 0.35, 벤치: 0.38 }[role];
  const atk = atkOf(s), cre = creOf(s);

  for (let i = 0; i < n; i++) {
    S.played++;
    let mins = 0;
    const inj = s.injury > 0;
    if (inj) s.injury--;
    else {
      const sp = startP * (s.cond < 35 ? 0.6 : 1);
      if (chance(sp)) {
        mins = chance(0.18) ? ri(60, 85) : 90;
        S.starts++;
      } else if (chance(subP)) mins = ri(8, 35);
    }
    let perf = 0, g = 0, a = 0, cs = false;
    if (mins > 0) {
      perf = (o - L.avg) / 10 + gauss() * 0.8 + (s.cond - 70) / 60 + (s.morale - 60) / 90;
      ({ g, a } = rollScoring(s, atk, cre, o, perf, L.avg, mins));
    }
    const wp = clamp(0.38 + (s.club.str - L.avg) * 0.024 + (mins ? perf * 0.035 + g * 0.12 : 0), 0.07, 0.88);
    const dp = (1 - wp) * 0.38;
    const x = rnd();
    const res: 'W' | 'D' | 'L' = x < wp ? 'W' : x < wp + dp ? 'D' : 'L';
    (S as unknown as Record<string, number>)[res.toLowerCase()] = ((S as unknown as Record<string, number>)[res.toLowerCase()] ?? 0) + 1;
    (r as unknown as Record<string, number>)[res.toLowerCase()] = ((r as unknown as Record<string, number>)[res.toLowerCase()] ?? 0) + 1;
    S.pts += res === 'W' ? 3 : res === 'D' ? 1 : 0;
    if (mins > 0) {
      if ((s.pos === 'DF' || s.pos === 'GK') && res !== 'L' && chance(0.32 + (s.club.str - L.avg) * 0.015 + (s.attrs.def - L.avg) * 0.006)) {
        cs = true;
        r.cs++;
        S.cs++;
      }
      let rating = 6.2 + g * 0.9 + a * 0.5 + perf * 0.35 + (cs ? 0.45 : 0) + (s.pos === 'DF' || s.pos === 'GK' ? (s.attrs.def - L.avg) / 25 : 0) + (res === 'W' ? 0.2 : res === 'L' ? -0.2 : 0) + gauss() * 0.25;
      rating = clamp(Math.round(rating * 10) / 10, 4.5, 10);
      S.apps++; S.mins += mins; S.goals += g; S.assists += a; S.ratingSum += rating;
      r.apps++; r.goals += g; r.assists += a; r.rs += rating;
      if (g >= 3) r.hl.push(`${S.played}R 해트트릭! ${g}골 폭발 (평점 ${rating})`);
      else if (g === 2) r.hl.push(`${S.played}R 멀티골 (평점 ${rating})`);
      else if (rating >= 8.5) r.hl.push(`${S.played}R 경기 최우수 선수 선정 (평점 ${rating})`);
      if (cs && s.pos === 'GK' && rating >= 8) r.hl.push(`${S.played}R 슈퍼 세이브 쇼, 무실점 (평점 ${rating})`);
      addStat(s, 'cond', -(mins / 90) * 3.2);
      r.games.push({ rd: S.played, res, mins, g, a, rating, cs });
      const ip = BAL.injuryRate * (s.cond < 40 ? 2.5 : 1) * (s.trait === 'iron' ? 0.35 : 1) * (s.age >= 31 ? 1.4 : 1);
      if (chance(ip)) {
        const big = chance(BAL.bigInjuryShare);
        s.injury = big ? ri(8, 18) : ri(1, 5);
        r.injured = true;
        r.hl.push(`${S.played}R ${big ? '심각한 부상' : '부상'}으로 교체 아웃… ${s.injury}경기 결장 예상`);
      }
    }
    if (!mins) r.games.push({ rd: S.played, res, mins: 0, inj });
    addStat(s, 'cond', 1.1);
  }
  const g = growthFactor(s);
  if (r.apps) for (const k of ATTR_KEYS) if (chance(wOf(s)[k] * 2)) addAttr(s, k, rnd() * g * (r.apps / n));
  const avg = r.apps ? r.rs / r.apps : 0;
  const tierF = (L.tier + 1) / 4;
  if (r.apps) {
    addStat(s, 'fame', (r.goals * 0.5 + r.assists * 0.25 + Math.max(0, avg - 6.6) * 2) * tierF);
    addStat(s, 'morale', (avg - 6.7) * 6 + (r.w - r.l) / 2);
    if (avg >= 7.1) addStat(s, 'trust', 1.2);
    else if (avg < 6.3) addStat(s, 'trust', -1);
  } else addStat(s, 'morale', -4);
  if (s.contract) addStat(s, 'money', s.contract.salary / LAST_PHASE);
  return r;
}

