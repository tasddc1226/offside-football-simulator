// ───────── 핵심 시뮬레이션 엔진 (engine.js 포트 + 스토리/체인 헬퍼 + 이벤트 추첨) ─────────
// 순환 import를 피하려고 원본 stories.js/events.js에 있던 몇몇 범용 헬퍼(turnNo, schedule, STORIES,
// rollEvent, resolveChoice, bestKey/weakKey 등)를 이 모듈로 모았습니다. 동작은 원본과 동일합니다.
import { LEAGUES, CLUBS, POS, TYPES, ATTR_KEYS, PHASES, LAST_PHASE, FOCUS_GROWTH, OFF_FOCUS_GROWTH, focusMod, focusOfType, typeForFocus, attrLabels, type AttrKey, type Pos, type League, type Club } from './data.js';
import { ovr, wOf, initSubs, legacyOvr, spreadAttr } from './attributes.js';
import { clamp, ri, pick, chance, gauss, poisson, rnd, hashStr } from './rng.js';
import { EVENTS } from './events-data.js';
import { BAL, adoptLatestBalance, choiceOdds, eventWeight } from './balance.js';
import type { GameState, Season, LogEntry, Choice, EventDef } from './types.js';

export const leagueOf = (id: string): League => LEAGUES.find((l) => l.id === id)!;
export const clubsIn = (id: string): Club[] => CLUBS.filter((c) => c.leagueId === id);
/** 주력 능력치 — 옛 저장본(focus 없음)은 유형에서 거꾸로 구한다. */
export const focusOf = (s: GameState): AttrKey[] => s.focus ?? focusOfType(s.pos, s.type);
export const labelOf = (s: GameState, k: AttrKey): string => attrLabels(s.pos)[k];

export function potGrade(s: GameState): string {
  const p = s.pot + (s.flags.potBonus ?? 0);
  return p >= 90 ? 'S' : p >= 84 ? 'A' : p >= 78 ? 'B' : p >= 70 ? 'C' : 'D';
}
export const truePot = (s: GameState): number => s.pot + (s.bloom ?? 0) + (s.flags.potBonus ?? 0);
const BLOOM_SCOUT = 3, BLOOM_DRIFT = 1.2, BLOOM_AGE = 25;
export function bloomTick(s: GameState): string | null {
  if (s.bloom == null) s.bloom = 0;
  if (s.age <= BLOOM_AGE) s.bloom = Math.round((s.bloom + gauss() * BLOOM_DRIFT) * 10) / 10;
  const n = s.flags.rescout ?? 0;
  if (!(n === 0 && s.age >= 21) && !(n === 1 && s.age >= 24)) return null;
  s.flags.rescout = n + 1;
  const before = potGrade(s);
  const k = Math.round(s.bloom * (n === 0 ? 0.5 : 0.8));
  s.pot += k;
  s.bloom = Math.round((s.bloom - k) * 10) / 10;
  const after = potGrade(s);
  if (after === before) return null;
  const up = after < before;
  log(s, `스카우트 재평가: 잠재력 ${before} → ${after}등급. ${up ? '늦게 핀 재능이라는 평가입니다.' : '성장 곡선이 예상보다 일찍 꺾였다는 평가입니다.'}`, up ? 'good' : 'bad');
  return `스카우트 재평가 · 잠재력 ${before} → ${after}`;
}
export function roleOf(s: GameState): '주전' | '로테이션' | '벤치' {
  if (leagueOf(s.leagueId).amateur) return ovr(s) >= s.club.str - 2 ? '주전' : ovr(s) >= s.club.str - 8 ? '로테이션' : '벤치';
  const d = ovr(s) - s.club.str + s.trust;
  return d >= 1 ? '주전' : d >= -5 ? '로테이션' : '벤치';
}
export function salaryFor(leagueId: string, o: number): number {
  const L = leagueOf(leagueId);
  return Math.round((L.wealth * 1000 * Math.exp((o - 60) / 10)) / 10) * 10;
}
export function fmtMoney(man: number): string {
  const m = Math.round(man);
  if (Math.abs(m) >= 10000) {
    // 천만 단위로 먼저 반올림해야 9,770만 → '1억'으로 올라간다('18억 10,000만' 방지). 음수는 부호만 앞에 붙인다.
    const t = Math.round(Math.abs(m) / 1000) * 1000;
    const e = Math.floor(t / 10000), r = t % 10000;
    return `${m < 0 ? '-' : ''}${e}억${r ? ` ${r.toLocaleString()}만` : ''}`;
  }
  return `${m.toLocaleString()}만`;
}

// ───────── 상태 변경 헬퍼 ─────────
export let JITTER: boolean | 'safe' = false;
export function setJitter(v: boolean | 'safe') {
  JITTER = v;
}
/** 이벤트 결과 수치의 변동 폭(배수). 안전한 선택의 이득은 줄어든다. 확률 도감(T-10-012)이 그대로 보여 준다. */
export const JITTER_RANGE = { safe: [0.4, 0.9], normal: [0.5, 1.5] } as const;
const jitIn = (v: number, [lo, hi]: readonly [number, number]) => v * (lo + rnd() * (hi - lo));
const jit = (v: number): number => (!JITTER ? v : JITTER === 'safe' && v > 0 ? jitIn(v, JITTER_RANGE.safe) : jitIn(v, JITTER_RANGE.normal));
export function addAttr(s: GameState, k: AttrKey, v: number) {
  spreadAttr(s, k, jit(v));
}
/** addStat()이 다룰 수 있는 실제 숫자 스탯 키. */
export type StatKey = 'money' | 'trust' | 'fame' | 'cond' | 'morale';
export function addStat(s: GameState, k: StatKey, v: number) {
  if (k !== 'money') v = jit(v);
  if (k === 'money') s.money = Math.round(s.money + v);
  else if (k === 'trust') s.trust = clamp(s.trust + v, -6, 6);
  // T-10-025: 인기는 상한 없이 쌓인다(하한 0만 유지). 밸런스에 닿는 공식은 fameEff()로 100까지만 반영한다.
  else if (k === 'fame') s.fame = Math.max(0, s.fame + v * (v > 0 && s.trait === 'star' ? 1.5 : v > 0 && s.trait === 'early' && s.age <= 23 ? 1.4 : 1));
  else s[k] = clamp((s[k] ?? 0) + v, 0, 100);
}
/** 이적 가치·대표 선발·광고비·수당처럼 밸런스에 닿는 공식에 쓰는 인기 — 상한을 풀기 전(100) 수준까지만 반영한다. */
export const fameEff = (s: GameState): number => Math.min(s.fame, 100);
export function log(s: GameState, text: string, kind = '', ph = s.phase) {
  s.log.unshift({ t: `${s.year} ${PHASES[ph] ?? ''}`, text, kind });
  s.log.length = Math.min(s.log.length, 60);
}

export type Snapshot = Record<AttrKey, number> & {
  ovr: number; cond: number; morale: number; fame: number; money: number; trust: number; injury: number; potB: number; stories: string[];
};
export function snapshot(s: GameState): Snapshot {
  return {
    ...s.attrs, ovr: ovr(s), cond: s.cond, morale: s.morale, fame: s.fame, money: s.money, trust: s.trust, injury: s.injury, potB: s.flags.potBonus ?? 0,
    stories: Object.keys(s.story || {}).filter((k) => !s.story[k]!.done),
  } as Snapshot;
}
type Chip = { label: string; d: number; money?: boolean; text?: string; bad?: boolean };
export function diffChips(s: GameState, a: Snapshot, b: Snapshot): Chip[] {
  const out: Chip[] = [];
  for (const k of ATTR_KEYS) {
    const d = Math.round(b[k]!) - Math.round(a[k]!);
    if (d) out.push({ label: labelOf(s, k), d });
  }
  const named: Record<string, string> = { ovr: 'OVR', cond: '컨디션', morale: '사기', fame: '인기', trust: '감독 신뢰' };
  const av = a as unknown as Record<string, number>, bv = b as unknown as Record<string, number>;
  for (const k in named) {
    const d = Math.round(bv[k]! - av[k]!);
    if (d) out.push({ label: named[k]!, d });
  }
  if (b.money !== a.money) out.push({ label: '자금', d: b.money! - a.money!, money: true });
  if (b.injury! > a.injury!) out.push({ label: '부상', d: b.injury! - a.injury!, text: `${b.injury}경기 결장`, bad: true });
  if (b.potB! > a.potB!) out.push({ label: '잠재력', d: 1, text: '상승' });
  return out;
}

// ───────── 새 커리어 ─────────
// T-10-002: presetAttrs가 주어지면(선수 생성 후보 카드에서 고른 분포) ri(-4,4) 루프를 건너뛰고
// 그 값을 그대로 쓴다 — presetAttrs를 넘기지 않는 기존 호출(특히 tooling/fulltime-sim이 직접
// 부르는 경로)은 RNG 소비 순서가 한 글자도 바뀌지 않는다(결정성/패리티 보존).
// T-10-008: 화면은 focus(주력 능력치)를 넘기고 type은 그 조합에서 파생한다. type만 넘기는 기존
// 호출(시뮬레이터·테스트)은 유형 mod·RNG 소비가 그대로이고, focus는 유형에서 거꾸로 구한다.
export function newGame(
  o: { name: string; number: number; pos: Pos; foot: GameState['foot']; trait: string } & ({ type: string; focus?: undefined } | { type?: undefined; focus: AttrKey[] }),
  seed: number,
  presetAttrs?: Record<AttrKey, number>,
): GameState {
  const attrs = {} as Record<AttrKey, number>;
  const typeId = o.focus ? typeForFocus(o.pos, o.focus) : o.type;
  const focus = o.focus ? [...o.focus] : focusOfType(o.pos, typeId);
  const mod = o.focus ? focusMod(o.pos, o.focus) : TYPES[o.pos].find((t) => t.id === typeId)!.mod;
  if (presetAttrs) {
    for (const k of ATTR_KEYS) attrs[k] = clamp(presetAttrs[k], 20, 70);
  } else {
    for (const k of ATTR_KEYS) attrs[k] = clamp(POS[o.pos].base[k] + (mod[k] ?? 0) + ri(-4, 4), 20, 70);
  }
  const club = pick(clubsIn('hs'));
  const pot = clamp(Math.round(74 + gauss() * 8), 55, 96);
  const scouted = clamp(Math.round(pot + gauss() * BLOOM_SCOUT), 55, 96);
  // sub/season/seasonStartSub은 initSubs()/newSeason() 호출로만 실제 값이 정해진다(둘 다 RNG를
  // 소모하므로, 그 호출 순서를 바꾸지 않기 위해 이 시점엔 아직 실행하지 않는다). 여기서는 타입을
  // 만족하는 빈 기본값을 채워 두고, 아래에서 원래 순서 그대로 덮어쓴다 — 캐스팅(타입 우회) 없이도
  // 리터럴이 GameState를 완전히 만족한다.
  const s: GameState = {
    // cid는 crypto.randomUUID()로 만든다 — 시드 RNG(rnd/ri/gauss 등)를 절대 소모하지 않는다.
    v: 1, cid: crypto.randomUUID(), halves: 1, name: o.name, number: o.number, pos: o.pos, foot: o.foot, type: typeId, focus, trait: o.trait,
    age: 18, year: 2026, attrs, sub: {}, pot: scouted, bloom: pot - scouted, cond: 90, morale: 70, fame: 3, trust: 0, money: 300,
    leagueId: 'hs', club: { ...club }, contract: null, phase: 0, uniYears: 0,
    season: { apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0, cs: 0, mins: 0, played: 0, pts: 0, w: 0, d: 0, l: 0, rivals: [], honors: [] },
    seasonStart: { ...attrs }, seasonStartSub: {},
    career: [], trophies: [], awards: [], titles: [], nat: { caps: 0, goals: 0, assists: 0, tours: [], qual: { 2026: true }, captain: false, debutYear: null },
    mil: { exempt: null, served: false, serving: false, left: 0, type: null, prevClub: null },
    injury: 0, log: [] as LogEntry[], pending: null,
    flags: {}, peak: 0, training: 'rest', retired: false, chains: [], story: {}, storyLog: [],
    rng: { seed },
  };
  initSubs(s, attrs, legacyOvr(o.pos, attrs));
  s.seasonStart = { ...s.attrs };
  s.seasonStartSub = { ...s.sub };
  s.peak = ovr(s);
  s.season = newSeason(s);
  log(s, `${club.name} 3학년 ${POS[s.pos].label} ${s.name}, 등번호 ${s.number}번으로 축구 커리어를 시작합니다.`, 'big');
  return s;
}

export function newSeason(s: GameState): Season {
  // T-10-016 서버의 새 밸런스 버전은 시즌이 바뀔 때만 커리어에 들어온다.
  if (adoptLatestBalance(s) && s.career.length) log(s, `밸런스 패치 v${s.bal!.v}가 이번 시즌부터 적용됩니다.`);
  const L = leagueOf(s.leagueId);
  const rivals: number[] = [];
  for (let i = 0; i < 19; i++) rivals.push(L.avg + gauss() * L.spread);
  return { apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0, cs: 0, mins: 0, played: 0, pts: 0, w: 0, d: 0, l: 0, rivals, honors: [] };
}

// ───────── 훈련 ─────────
export function growthFactor(s: GameState): number {
  const a = s.age;
  let f: number;
  if (s.trait === 'early') f = a <= 20 ? 1.5 : a <= 23 ? 1.15 : a <= 26 ? 0.6 : 0.14;
  else if (s.trait === 'late') f = a <= 21 ? 0.85 : a <= 25 ? 1.15 : a <= 29 ? 0.8 : 0.25;
  else f = a <= 21 ? 1.3 : a <= 24 ? 1 : a <= 27 ? 0.55 : a <= 30 ? 0.22 : 0.08;
  const pot = truePot(s);
  f *= clamp((pot - ovr(s)) / 12, 0.04, 1.3);
  f *= 0.75 + s.morale / 200;
  return f * BAL.growthScale;
}
export interface TrainingDef {
  id: string;
  attr?: AttrKey;
  label?: string;
  desc?: string;
}
export const TRAININGS: TrainingDef[] = [
  ...ATTR_KEYS.map((k) => ({ id: k, attr: k })),
  { id: 'rest', label: '휴식·회복', desc: '컨디션 대폭 회복' },
  { id: 'coach', label: '개인 코치', desc: '전 능력 소폭 ▲ · 비용' },
  { id: 'media', label: '미디어 활동', desc: '인기 ▲ · 컨디션 ▼' },
];
export function trainingLabel(s: GameState, t: TrainingDef): string {
  return t.attr ? `${labelOf(s, t.attr)} 훈련` : t.label!;
}
export function trainingDesc(s: GameState, t: TrainingDef): string {
  if (t.id === 'coach') return `비용 ${fmtMoney(coachCost(s))}`;
  if (!t.attr) return t.desc!;
  const main = focusOf(s).includes(t.attr) ? `주력 · 성장 +${Math.round((FOCUS_GROWTH - 1) * 100)}% · ` : '';
  return `${main}${labelOf(s, t.attr)} 집중 성장 · OVR 반영 ${Math.round(wOf(s)[t.attr] * 100)}%`;
}
export function coachCost(s: GameState): number {
  return Math.max(200, Math.round(((s.contract ? s.contract.salary : 0) * 0.06) / 10) * 10);
}

const TRAIN_X = 5 / 3;
export function applyTraining(s: GameState) {
  const g = growthFactor(s);
  const t = s.training;
  if (t === 'rest') {
    addStat(s, 'cond', 30);
    addStat(s, 'morale', 4);
    return;
  }
  if (t === 'media') {
    addStat(s, 'fame', ri(5, 9));
    addStat(s, 'cond', -5);
    addStat(s, 'morale', 3);
    if (s.contract) addStat(s, 'money', Math.round(fameEff(s) * 8));
    return;
  }
  if (t === 'coach') {
    const c = coachCost(s);
    if (s.money < c) {
      log(s, '자금이 부족해 개인 코치 대신 자율 훈련을 했습니다.');
      s.training = 'rest';
      addStat(s, 'cond', 10);
      return;
    }
    addStat(s, 'money', -c);
    for (const k of ATTR_KEYS) if (wOf(s)[k] > 0.05) addAttr(s, k, (0.6 + rnd()) * g * TRAIN_X);
    addStat(s, 'cond', -6);
    return;
  }
  addAttr(s, t as AttrKey, (1.6 + rnd() * 2.6) * g * TRAIN_X * (focusOf(s).includes(t as AttrKey) ? FOCUS_GROWTH : OFF_FOCUS_GROWTH));
  if (t === 'phy') addAttr(s, 'pac', rnd() * g * TRAIN_X);
  if (chance(0.5)) addAttr(s, pick(ATTR_KEYS), rnd() * g * TRAIN_X);
  addStat(s, 'cond', t === 'phy' ? -12 : -8);
}

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
 * 기대값이 지수로 불어나 한 시즌 80골이 나왔다 — 압도적인 선수도 경기당 득점에는 한계가 있다. */
export const DOMINANCE_KNEE = 14, DOMINANCE_SLOPE = 0.15;
export const dominance = (gap: number): number => (gap <= DOMINANCE_KNEE ? gap : DOMINANCE_KNEE + (gap - DOMINANCE_KNEE) * DOMINANCE_SLOPE);
/** 득점·도움 기대값 배수. atk는 공격(또는 창의) 능력치, perf는 경기력(평균 대비 OVR 우위 o - avg를 포함)이다. */
export function scoreBoost(atk: number, o: number, perf: number, avg: number): number {
  return Math.exp(dominance(atk - avg) / 20 + (perf + (dominance(o - avg) - (o - avg)) / 10) * 0.2);
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
export function simBlock(s: GameState): BlockResult {
  const L = leagueOf(s.leagueId), P = POS[s.pos], S = s.season;
  const n = s.phase >= LAST_PHASE ? L.matches - S.played : Math.min(blockMatches(s), L.matches - S.played);
  const role = roleOf(s), o = ovr(s);
  const r: BlockResult = { n, apps: 0, goals: 0, assists: 0, rs: 0, w: 0, d: 0, l: 0, cs: 0, hl: [], injured: false, games: [] };
  const startP = { 주전: 0.92, 로테이션: 0.5, 벤치: 0.12 }[role];
  const subP = { 주전: 0.05, 로테이션: 0.35, 벤치: 0.38 }[role];
  const atk = Object.entries(P.atk).reduce((t, [k, w]) => t + s.attrs[k as AttrKey] * (w as number), 0);
  const cre = s.attrs.pas * 0.7 + s.attrs.dri * 0.3;

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
      g = poisson(P.goal * scoreBoost(atk, o, perf, L.avg) * (mins / 90));
      a = poisson(P.assist * scoreBoost(cre, o, perf, L.avg) * (mins / 90));
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

// ───────── 순위 ─────────
// 시즌마다 상대 전력 19개(S.rivals)를 뽑지만, 리그의 실제 팀 수는 12~20개다(T-10-009). T-10-024부터
// 순위는 실제 팀 수에 맞춰 가장 강한 (팀 수 - 1)개 상대하고만 매긴다 — 약한 쪽을 버리므로 우승·상위권
// 확률은 그대로이고, 순위표의 팀 이름과 순위 범위가 맞는다(30팀인 MLS는 상대가 19개뿐이라 20팀까지).
// RNG 소비(finalRank의 난수)는 19개 모두에 대해 그대로 일어난다.
const basePpg = (L: League, str: number) => 1.35 + (str - L.avg) * 0.06;

/** 순위에 들어가는 상대 인덱스(S.rivals 기준, 강한 순). */
function rankedRivals(s: GameState): number[] {
  const R = s.season.rivals;
  const n = Math.max(1, Math.min(R.length, clubsIn(s.leagueId).length - 1));
  return R.map((_, i) => i).sort((a, b) => R[b]! - R[a]!).slice(0, n);
}

export interface TableRow {
  name: string;
  me: boolean;
  p: number;
  w: number;
  d: number;
  l: number;
  pts: number;
}

/** 현재까지의 리그 순위표. 상대 팀 승점은 전력으로 매긴 기대 승점에 팀별 고정 편차를 더한 값이고(난수 없음), 승점이 같으면
 * 내 팀이 위다. 상대 팀 이름은 리그 클럽을 전력 순으로 짝지어 붙인다. */
export function leagueTable(s: GameState): TableRow[] {
  const L = leagueOf(s.leagueId), S = s.season, P = S.played;
  const names = clubsIn(s.leagueId).filter((c) => c.id !== s.club.id).sort((a, b) => b.str - a.str).map((c) => c.name);
  const rows: TableRow[] = rankedRivals(s).map((ri, k) => {
    const name = names[k] ?? `${L.name} ${k + 1}`;
    // 팀·시즌·경기 수로 정해지는 고정 편차(난수 아님) — 같은 전력대 팀들이 똑같은 전적으로 겹치지 않게.
    const h = hashStr(`${name}|${s.year}`);
    const jitter = P ? ((h + P * 7) % 5) - 2 : 0;
    const pts = clamp(Math.round(clamp(basePpg(L, S.rivals[ri]!), 0.4, 2.6) * P) + jitter, 0, 3 * P);
    // 무승부는 경기의 18~32%(팀마다 다름). 승점이 정확히 맞도록 승·무를 나눈다.
    let w = Math.max(0, Math.floor((pts - Math.round(P * (0.18 + (h % 15) / 100))) / 3));
    let d = pts - 3 * w;
    while (w + d > P && d >= 3) {
      w++;
      d -= 3;
    }
    return { name, me: false, p: P, w, d, l: P - w - d, pts };
  });
  rows.push({ name: s.club.name, me: true, p: P, w: S.w, d: S.d, l: S.l, pts: S.pts });
  return rows.sort((a, b) => b.pts - a.pts || Number(b.me) - Number(a.me));
}

export function teamRank(s: GameState): number | null {
  if (!s.season.played) return null;
  return leagueTable(s).findIndex((r) => r.me) + 1;
}
export function finalRank(s: GameState): number {
  const L = leagueOf(s.leagueId), S = s.season;
  const ranked = new Set(rankedRivals(s));
  let rank = 1;
  S.rivals.forEach((str, i) => {
    const pts = Math.round(L.matches * clamp(basePpg(L, str) + gauss() * 0.12, 0.4, 2.6));
    const above = pts > S.pts || (pts === S.pts && chance(0.5));
    if (above && ranked.has(i)) rank++;
  });
  return rank;
}

// ───────── 스토리/체인 헬퍼 (원본 stories.js) ─────────
export interface StoryDef {
  name: string;
  total: number;
}
export const STORIES: Record<string, StoryDef> = {
  rival: { name: '평생의 라이벌', total: 3 },
  rehab: { name: '재활의 시간', total: 3 },
  scandal: { name: '스캔들', total: 3 },
  europe: { name: '유럽의 꿈', total: 3 },
  mentor: { name: '감독과의 인연', total: 3 },
};
export function turnNo(s: GameState): number {
  return (s.year - 2026) * (LAST_PHASE + 1) + Math.min(s.phase, LAST_PHASE);
}
export function schedule(s: GameState, id: string, delay: number, window = 6) {
  s.chains = (s.chains || []).filter((c) => c.id !== id);
  const at = turnNo(s) + delay;
  s.chains.push({ id, at, until: at + window });
}
export function storyActive(s: GameState, key: string): boolean {
  return !!(s.story && s.story[key] && !s.story[key]!.done);
}
export function startStory(s: GameState, key: string, data: Record<string, unknown> = {}) {
  s.story = s.story || {};
  s.story[key] = { stage: 1, done: false, ...data };
}
export function advanceStory(s: GameState, key: string, stage: number) {
  if (storyActive(s, key)) s.story[key]!.stage = stage;
}
export function endStory(s: GameState, key: string, ending: string) {
  if (!storyActive(s, key)) return;
  const st = s.story[key]!;
  st.done = true;
  st.ending = ending;
  s.storyLog = s.storyLog || [];
  s.storyLog.push({ year: s.year, key, name: STORIES[key]!.name, ending });
  s.chains = (s.chains || []).filter((c) => {
    const e = EVENTS.find((x) => x.id === c.id);
    return !e || e.story !== key;
  });
  log(s, `[스토리 완결] ${STORIES[key]!.name} · ${ending}`, 'big', Math.max(0, s.phase - 1));
}

// ───────── 이벤트 문구/조건 공용 헬퍼 (원본 events.js) ─────────
export const isPro = (s: GameState): boolean => !leagueOf(s.leagueId).amateur;
export const byPos = <T>(m: Partial<Record<Pos | 'def', T>>) => (s: GameState): T => (m[s.pos] ?? m.def) as T;
export const txt = <T>(v: T | ((s: GameState) => T), s: GameState): T => (typeof v === 'function' ? (v as (s: GameState) => T)(s) : v);
export const isAtk = (s: GameState): boolean => s.pos === 'FW' || s.pos === 'MF';
export function adFee(s: GameState): number {
  const f = fameEff(s);
  return Math.round((f * f * 1.2) / 10) * 10 + 200;
}
export function trainerFee(s: GameState): number {
  return Math.max(1000, Math.round(((s.contract ? s.contract.salary : 0) * 0.15) / 10) * 10);
}
export function bestKey(s: GameState): AttrKey {
  return ATTR_KEYS.filter((k) => wOf(s)[k] > 0.05).sort((a, b) => s.attrs[b] - s.attrs[a])[0]!;
}
export function weakKey(s: GameState): AttrKey {
  return ATTR_KEYS.filter((k) => wOf(s)[k] > 0.09).sort((a, b) => s.attrs[a] - s.attrs[b])[0]!;
}
export function agentFee(s: GameState): number {
  return Math.max(500, Math.round(((s.contract ? s.contract.salary : 0) * 0.1) / 10) * 10);
}

/** 이벤트 규칙. 확률 도감(T-10-012)이 이 값을 그대로 읽어 공개한다 — 숫자를 바꾸면 도감도 따라 바뀐다. */
export const EVENT_RULES = {
  /** 구간마다 이벤트가 생길 확률(프리시즌 / 전·후반기). 연쇄 이벤트는 예정대로 따로 온다. */
  // T-10-016 확률 세 개는 서버 밸런스 설정(BAL)을 읽는다.
  rate: {
    get preseason() {
      return BAL.eventRatePreseason;
    },
    get season() {
      return BAL.eventRateSeason;
    },
  },
  /** 같은 이벤트가 다시 나오기까지 최소 구간 수. 이미 본 이벤트는 가중치가 1/(1+본 횟수)로 준다. */
  cooldown: 9,
  /** 선택 뒤 반전이 붙을 확률. 안전한 선택은 먼저 이 확률로 대가를 치른다. */
  get twist() {
    return BAL.eventTwist;
  },
  /** 반전이 능력치 변화일 때 오를 확률(안전 / 도전 성공·확정 / 도전 실패). */
  twistUp: { safe: 0.3, ok: 0.65, fail: 0.4 },
  /** 안전한 선택의 대가(셋 중 하나, 폭 안에서 무작위). */
  safeCost: [
    { k: 'morale', label: '사기', min: 3, max: 6, why: '도전하지 않은 아쉬움' },
    { k: 'trust', label: '감독 신뢰', min: 1, max: 1, why: '감독의 미지근한 평가' },
    { k: 'fame', label: '명성', min: 2, max: 4, why: '"무난했다"는 평가' },
  ],
} as const;
const EV_COOLDOWN = EVENT_RULES.cooldown;
export const isSafe = (ev: EventDef, c: Choice): boolean => !c.fail && ev.choices.some((x) => !!x.fail);
export function rollEvent(s: GameState): string | null {
  const t = turnNo(s);
  s.chains = s.chains || [];
  for (const c of s.chains.filter((c) => c.until < t)) {
    const e = EVENTS.find((x) => x.id === c.id);
    if (e && e.story) endStory(s, e.story, e.expireEnding || '흐지부지 끝난 이야기');
  }
  s.chains = s.chains.filter((c) => c.until >= t);
  const due = s.chains.find((c) => c.at <= t && EVENTS.find((e) => e.id === c.id)!.cond(s));
  if (due) {
    s.chains = s.chains.filter((c) => c !== due);
    s.flags.lastEvent = due.id;
    return due.id;
  }
  if (!chance(s.phase === 0 ? EVENT_RULES.rate.preseason : EVENT_RULES.rate.season)) return null;
  // 대입식의 값(원본 객체)이 아니라 다시 읽은 값을 쓴다 — s가 Svelte $state 프록시면 원본에 쓴 값이 반영되지 않을 수 있다.
  if (!s.flags.evSeen) s.flags.evSeen = {};
  const seen = s.flags.evSeen;
  const pool = EVENTS.filter((e) => !e.chain && e.cond(s) && s.flags.lastEvent !== e.id && !(seen[e.id] && t - seen[e.id]!.t < EV_COOLDOWN));
  if (!pool.length) return null;
  const weightOf = (e: EventDef) => (e.w * eventWeight(e.id)) / (1 + (seen[e.id] ? seen[e.id]!.n : 0));
  const tot = pool.reduce((a, e) => a + weightOf(e), 0);
  let x = rnd() * tot;
  const ev = pool.find((e) => (x -= weightOf(e)) <= 0) || pool[0]!;
  s.flags.lastEvent = ev.id;
  seen[ev.id] = { t, n: (seen[ev.id] ? seen[ev.id]!.n : 0) + 1 };
  return ev.id;
}
export interface ResolveResult {
  ok: boolean;
  text: string;
  chips: Chip[];
  p: number;
  roll: number;
  story: { name: string; ending: string | null; started: boolean } | null;
  twist: string | null;
}
export function resolveChoice(s: GameState, evId: string, idx: number): ResolveResult {
  const ev = EVENTS.find((e) => e.id === evId)!;
  const c = ev.choices[idx]!;
  const p = choiceOdds(c.p?.(s), evId, idx);
  const roll = rnd();
  const ok = roll < p;
  const out = ok || !c.fail ? c.ok : c.fail;
  const before = snapshot(s);
  const text = txt(out.text, s);
  log(s, `[${ev.title}] ${text}`, ok ? 'good' : 'bad', Math.max(0, s.phase - 1));
  const safe = isSafe(ev, c);
  setJitter(safe ? 'safe' : true);
  try {
    out.fx(s);
  } finally {
    setJitter(false);
  }
  let twist: string | null = null;
  if (safe && chance(EVENT_RULES.twist)) {
    // 폭이 있는 항목만 RNG를 쓴다(원래 호출 순서: 사기 → 명성 → pick).
    const [k, d, why] = pick(EVENT_RULES.safeCost.map(({ k, min, max, why }) => [k, -(min === max ? min : ri(min, max)), why] as const));
    addStat(s, k, d);
    twist = '안전한 선택의 대가 · ' + why;
  } else if (chance(EVENT_RULES.twist)) {
    const k = pick(ATTR_KEYS.filter((x) => wOf(s)[x] > 0.09));
    const up = chance(safe ? EVENT_RULES.twistUp.safe : ok ? EVENT_RULES.twistUp.ok : EVENT_RULES.twistUp.fail);
    const d = up ? ri(1, 2) : -1;
    addAttr(s, k, d);
    twist = up ? `뜻밖의 수확 · ${labelOf(s, k)} +${d}` : `예상 못 한 여파 · ${labelOf(s, k)} ${d}`;
  }
  const key = ev.story || Object.keys(s.story || {}).find((k) => !before.stories.includes(k) && storyActive(s, k));
  const st = key ? s.story[key] : undefined;
  const story = st ? { name: STORIES[key!]!.name, ending: st.done ? st.ending! : null, started: !ev.story } : null;
  return { ok, text, chips: diffChips(s, before, snapshot(s)), p, roll, story, twist };
}
export function pkWin(s: GameState) {
  const S = s.season;
  if (S.d > 0) {
    S.d--;
    S.w++;
    S.pts += 2;
  }
}
