// ───────── 선수 생성 후보 카드 (T-10-002) ─────────
// 이름/등번호/포지션/주발/주력 능력치(T-10-008)/성장 특성을 고른 다음, 같은 총합(능력치 합)을 가지되
// 분포가 서로 다른 후보 3명을 보여준다. 이 파일은 game/rng.ts의 시드 RNG(활성 게임의 rnd/ri/
// pick/gauss/poisson)를 절대 쓰지 않는다 — 로컬 mulberry32 인스턴스를 매 호출마다 새로 만들어
// 쓰고 저장하지 않는(non-persisted) "별도의 랜덤 소스"만 사용한다. 그래서 후보 카드를 몇 번을
// 다시 뽑든 메인 게임 RNG 스트림은 전혀 움직이지 않고, newGame()에 최종 선택한 분포를
// presetAttrs로 넘기면(엔진 쪽 ri(-4,4) 루프를 건너뛰므로) fulltime-sim이 쓰는 newGame() 기본
// 경로(코치/시뮬레이터가 직접 호출하는 경로, presetAttrs 없음)의 RNG 소비 순서도 그대로다.
import { BAL } from './balance.js';
import { PRESEASON_POT } from '@offside/contracts/balance';
import { gauss } from './rng.js';
import { gradeOf } from './stats.js';
import { ATTR_KEYS, DPOS, POS, focusMod, type AttrKey, type DetailPos, type Pos } from './data.js';

// 로컬(비영속) mulberry32 — game/rng.ts의 활성 RNG와 완전히 분리되어 있다.
function localRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CandidatePotential {
  value: number;
  scouted: number;
  min: number;
  max: number;
}

/** Display only grade bounds; exact values stay internal to the career engine. */
export function candidatePotentialGrades(p: Pick<CandidatePotential, 'min' | 'max'>) {
  return { min: gradeOf(p.min), max: gradeOf(p.max) };
}

export interface Candidate {
  /** Fixed at scouting; revealing it never changes the draw. */
  potential: CandidatePotential;
  attrs: Record<AttrKey, number>;
  total: number;
  /** 가장 높은 능력치 2개 — 열린 후보 카드에서 막대를 강조한다. */
  hintKeys: AttrKey[];
  /** T-11-196 프리미엄 스카우트의 A 이상 보장 후보. */
  guaranteed?: boolean;
}

const CLAMP = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** pos/주력 능력치에 대한 "기준 분포"(랜덤 없음) — 세 후보 모두 이 총합을 공유한다. */
export function baseline(
  pos: Pos,
  focus: readonly AttrKey[],
  dpos?: DetailPos | null,
): Record<AttrKey, number> {
  const mod = focusMod(pos, focus);
  const dmod = dpos ? DPOS[dpos].mod : {};
  const out = {} as Record<AttrKey, number>;
  for (const k of ATTR_KEYS)
    out[k] = CLAMP(POS[pos].base[k] + (mod[k] ?? 0) + (dmod[k] ?? 0), 20, 70);
  return out;
}

/** 총합을 유지한 채(한 능력치에서 다른 능력치로 옮기는 방식) 무작위로 재분배한다. 주력 능력치는
 * 깎지 않는다 — 어느 후보를 골라도 고른 강점이 기준선 아래로 내려가지 않는다. */
function redistribute(
  base: Record<AttrKey, number>,
  focus: readonly AttrKey[],
  rand: () => number,
  rounds = 10,
  step = 3,
): Record<AttrKey, number> {
  const out = { ...base };
  for (let i = 0; i < rounds; i++) {
    const from = ATTR_KEYS[Math.floor(rand() * ATTR_KEYS.length)]!;
    const to = ATTR_KEYS[Math.floor(rand() * ATTR_KEYS.length)]!;
    if (from === to || focus.includes(from)) continue;
    const amt = Math.min(step, out[from] - 20, 70 - out[to]);
    if (amt <= 0) continue;
    out[from] -= amt;
    out[to] += amt;
  }
  return out;
}

/** T-10-112 스카우트 시드와 조건(포지션·세부 포지션·주력)을 섞은 후보 난수 시드 — 주력은 고른 순서와 무관하다. */
function candidateSeed(
  seed: number,
  pos: Pos,
  focus: readonly AttrKey[],
  dpos?: DetailPos | null,
): number {
  let h = 0x811c9dc5 ^ (seed >>> 0);
  for (const ch of `${pos}|${dpos ?? ''}|${[...focus].sort().join(',')}`)
    h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return h >>> 0;
}

/** 후보 3명을 만든다. 세 후보의 attrs 합계는 모두 같다(baseline 총합과 동일) — 분포만 다르다.
 * T-10-112 seed를 주면 같은 시드·조건에서 늘 같은 후보가 나온다(다시 뽑아 고르는 리세 방지). */
export function generateCandidates(
  pos: Pos,
  focus: readonly AttrKey[],
  dpos?: DetailPos | null,
  seed: number = Math.floor(Math.random() * 0xffffffff),
  n = 3,
  premium = false,
): Candidate[] {
  const base = baseline(pos, focus, dpos);
  const rand = localRng(candidateSeed(seed, pos, focus, dpos));
  const draw = potDraw(dpos);
  const sure = premium ? Math.floor(localRng((seed ^ 0x5bd1e995) >>> 0)() * n) : -1;
  const out: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    const attrs = i === 0 ? { ...base } : redistribute(base, focus, rand, 8 + i * 4, 4);
    const sorted = ATTR_KEYS.slice().sort((a, b) => attrs[b] - attrs[a]);
    // Potential ignores position/focus edits, preventing a fresh draw by editing the form.
    const potRng = localRng((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    const value = CLAMP(
      Math.round(
        premium ? premiumPot(draw, potRng, i === sure) : draw.mean + gauss(potRng) * draw.sd,
      ),
      55,
      96,
    );
    const scouted = CLAMP(Math.round(value + gauss(potRng) * BAL.potScoutSd), 55, 96);
    // 보장 후보는 표시 하한을 A(84)로 올린다 — 10단위 범위(80–89)로 'B–A'가 보이면 보장과 어긋난다. 표시 전용이다.
    const min = Math.max(55, Math.floor(value / 10) * 10, i === sure ? 84 : 0);
    out.push({
      potential: { value, scouted, min, max: Math.min(96, Math.floor(value / 10) * 10 + 9) },
      attrs,
      total: ATTR_KEYS.reduce((sum, k) => sum + attrs[k], 0),
      hintKeys: sorted.slice(0, 2),
      ...(i === sure ? { guaranteed: true } : {}),
    });
  }
  return out;
}

// ───────── T-11-196 프리미엄 스카우트 ─────────
// 일반 후보의 잠재력은 정규분포(평균·표준편차는 밸런스 설정)에서 뽑는다. 프리미엄은 등급을 먼저 정확한 확률로 고른 뒤
// 그 등급 구간 안에서 같은 정규분포를 따라 값을 뽑는다. 후보 한 명이 S일 확률은 일반의 정확히 2배이고, 세 명 중 한 명(보장
// 후보)은 A 이상이다. 보장 후보가 아닌 두 명은 S가 아닐 때 일반 분포의 A~D 비율을 그대로 따른다. 화면에 공개하는 확률표는
// scoutOdds()가 같은 식으로 계산한다.

/** 등급 경계(반올림 전 값). gradeOf: S ≥ 90, A ≥ 84, B ≥ 78, C ≥ 70. */
const CUT = { S: 89.5, A: 83.5, B: 77.5, C: 69.5 } as const;
export const SCOUT_GRADES = ['S', 'A', 'B', 'C', 'D'] as const;
export type ScoutGrade = (typeof SCOUT_GRADES)[number];

const potDraw = (dpos?: DetailPos | null) =>
  dpos ? { mean: BAL.potMean, sd: BAL.potSd } : PRESEASON_POT;

/** 표준정규 누적분포(Abramowitz–Stegun 7.1.26, 오차 1e-7 수준). 확률 도감(app-core fairness.ts)도 이 함수를 쓴다. */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** phi의 역함수(이분법). */
function phiInv(p: number): number {
  let lo = -9,
    hi = 9;
  for (let k = 0; k < 50; k++) {
    const mid = (lo + hi) / 2;
    if (phi(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 일반 후보 한 명의 등급 확률(0~1). */
function normalOdds(draw: { mean: number; sd: number }): Record<ScoutGrade, number> {
  const at = (cut: number) => phi((cut - draw.mean) / draw.sd);
  const [s, a, b, c] = [at(CUT.S), at(CUT.A), at(CUT.B), at(CUT.C)];
  return { S: 1 - s, A: s - a, B: a - b, C: b - c, D: c };
}

/** 정규분포를 [lo, hi) 누적확률 구간으로 자른 뒤 u(0~1)로 값 하나. */
const within = (draw: { mean: number; sd: number }, lo: number, hi: number, u: number) =>
  draw.mean + draw.sd * phiInv(lo + (hi - lo) * u);

function premiumPot(draw: { mean: number; sd: number }, r: () => number, sure: boolean): number {
  const sCut = phi((CUT.S - draw.mean) / draw.sd);
  const pS = Math.min(1, 2 * (1 - sCut));
  const pick = r(),
    u = r();
  if (pick < pS) return within(draw, sCut, 1, u);
  if (sure) return within(draw, phi((CUT.A - draw.mean) / draw.sd), sCut, u);
  return within(draw, 0, sCut, u);
}

export interface ScoutOdds {
  /** 일반 후보 한 명. */
  normal: Record<ScoutGrade, number>;
  /** 프리미엄 보장 후보(세 명 중 한 명). */
  sure: Record<ScoutGrade, number>;
  /** 프리미엄의 나머지 두 명. */
  rest: Record<ScoutGrade, number>;
}

/** T-11-196 확률 공개표 — 지금 밸런스 설정(시즌 개막 전이면 개막 전 분포)으로 계산한 후보 한 명의 등급 확률(0~1). */
export function scoutOdds(dpos?: DetailPos | null): ScoutOdds {
  const normal = normalOdds(potDraw(dpos));
  const pS = Math.min(1, 2 * normal.S);
  const keep = normal.S < 1 ? (1 - pS) / (1 - normal.S) : 0;
  return {
    normal,
    sure: { S: pS, A: 1 - pS, B: 0, C: 0, D: 0 },
    rest: {
      S: pS,
      A: normal.A * keep,
      B: normal.B * keep,
      C: normal.C * keep,
      D: normal.D * keep,
    },
  };
}
