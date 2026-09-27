// ───────── 잠재력·상태 변경 헬퍼 (T-10-046: engine.ts에서 분리) ─────────
import { ATTR_KEYS, PHASES, type AttrKey } from './data.js';
import { ovr, spreadAttr } from './attributes.js';
import { clamp, gauss, rnd } from './rng.js';
import type { GameState } from './types.js';
import { labelOf } from './player.js';

const gradeOf = (p: number) =>
  p >= 90 ? 'S' : p >= 84 ? 'A' : p >= 78 ? 'B' : p >= 70 ? 'C' : 'D';
/** 스카우트 평가 등급(한 점). 재평가 로그·판정이 쓴다 — 화면에는 potLabel로 흐리게 보인다. */
export function potGrade(s: GameState): string {
  return gradeOf(s.pot + (s.flags.potBonus ?? 0));
}
export const truePot = (s: GameState): number => s.pot + (s.bloom ?? 0) + (s.flags.potBonus ?? 0);
/** T-10-073 화면에 보이는 스카우트 평가의 오차(능력치 점수). 재평가(21·24세, flags.rescout)를 거칠수록 좁아진다. */
const POT_FOG = [4, 2, 0] as const;
/** 화면용 스카우트 평가 — 재평가 전에는 'C~B'처럼 범위로만 보인다. 실제 잠재력은 은퇴 때 공개된다(potReveal). */
export function potLabel(s: GameState): string {
  const p = s.pot + (s.flags.potBonus ?? 0);
  const fog = POT_FOG[Math.min(s.flags.rescout ?? 0, POT_FOG.length - 1)]!;
  const lo = gradeOf(p - fog),
    hi = gradeOf(p + fog);
  return lo === hi ? lo : `${lo}~${hi}`;
}
/** 아직 재평가가 남아 범위가 좁혀질 수 있는지. */
export const potFogged = (s: GameState): boolean => (s.flags.rescout ?? 0) < POT_FOG.length - 1;
/** T-10-073 은퇴 때 공개하는 실제 잠재력과 마지막 스카우트 평가.
 * T-10-075 ach: 최고 OVR ÷ 실제 잠재력(%) — 훈련·관리로 잠재력을 얼마나 끌어냈는지. 잠재력 근처에서도 느리게
 * 자라므로 100을 넘을 수 있다(시뮬 smart 중앙값 99, 10~90% 95~104, OVR 비중 0 능력치만 훈련하면 중앙값 84). */
export const potReveal = (s: GameState) => ({
  real: gradeOf(truePot(s)),
  scout: potGrade(s),
  ach: Math.round((s.peak / truePot(s)) * 100),
});
/** T-10-075 달성도 한 줄. */
export function potAchText(ach: number): string {
  if (ach >= 102) return '타고난 한계를 넘어섰어요.';
  if (ach >= 97) return '재능을 끝까지 끌어냈어요.';
  if (ach >= 92) return '조금은 남겨 두고 떠났어요.';
  return '다 피우지 못한 재능이었어요.';
}
export const BLOOM_SCOUT = 3;
const BLOOM_DRIFT = 1.2,
  BLOOM_AGE = 25;
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
  log(
    s,
    `스카우트 재평가: 잠재력 ${before} → ${after}등급. ${up ? '늦게 핀 재능이라는 평가입니다.' : '성장 곡선이 예상보다 일찍 꺾였다는 평가입니다.'}`,
    up ? 'good' : 'bad',
  );
  return `스카우트 재평가 · 잠재력 ${before} → ${after}`;
}
// ───────── 상태 변경 헬퍼 ─────────
export let JITTER: boolean | 'safe' = false;
export function setJitter(v: boolean | 'safe') {
  JITTER = v;
}
/** 이벤트 결과 수치의 변동 폭(배수). 안전한 선택의 이득은 줄어든다. 확률 도감(T-10-012)이 그대로 보여 준다. */
export const JITTER_RANGE = { safe: [0.4, 0.9], normal: [0.5, 1.5] } as const;
const jitIn = (v: number, [lo, hi]: readonly [number, number]) => v * (lo + rnd() * (hi - lo));
const jit = (v: number): number =>
  !JITTER
    ? v
    : JITTER === 'safe' && v > 0
      ? jitIn(v, JITTER_RANGE.safe)
      : jitIn(v, JITTER_RANGE.normal);
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
  else if (k === 'fame')
    s.fame = Math.max(
      0,
      s.fame +
        v *
          (v > 0 && s.trait === 'star'
            ? 1.5
            : v > 0 && s.trait === 'early' && s.age <= 23
              ? 1.4
              : 1),
    );
  else s[k] = clamp((s[k] ?? 0) + v, 0, 100);
}
/** 이적 가치·대표 선발·광고비·수당처럼 밸런스에 닿는 공식에 쓰는 인기 — 상한을 풀기 전(100) 수준까지만 반영한다. */
export const fameEff = (s: GameState): number => Math.min(s.fame, 100);
export function log(s: GameState, text: string, kind = '', ph = s.phase) {
  s.log.unshift({ t: `${s.year} ${PHASES[ph] ?? ''}`, text, kind });
  s.log.length = Math.min(s.log.length, 60);
}

export type Snapshot = Record<AttrKey, number> & {
  ovr: number;
  cond: number;
  morale: number;
  fame: number;
  money: number;
  trust: number;
  injury: number;
  potB: number;
  stories: string[];
};
export function snapshot(s: GameState): Snapshot {
  return {
    ...s.attrs,
    ovr: ovr(s),
    cond: s.cond,
    morale: s.morale,
    fame: s.fame,
    money: s.money,
    trust: s.trust,
    injury: s.injury,
    potB: s.flags.potBonus ?? 0,
    stories: Object.keys(s.story || {}).filter((k) => !s.story[k]!.done),
  } as Snapshot;
}
const NAMED_CHIPS = [
  ['ovr', 'OVR'],
  ['cond', '컨디션'],
  ['morale', '사기'],
  ['fame', '인기'],
  ['trust', '감독 신뢰'],
] as const;
export type Chip = { label: string; d: number; money?: boolean; text?: string; bad?: boolean };
export function diffChips(s: GameState, a: Snapshot, b: Snapshot): Chip[] {
  const out: Chip[] = [];
  for (const k of ATTR_KEYS) {
    const d = Math.round(b[k]!) - Math.round(a[k]!);
    if (d) out.push({ label: labelOf(s, k), d });
  }
  for (const [k, label] of NAMED_CHIPS) {
    const d = Math.round(b[k] - a[k]);
    if (d) out.push({ label, d });
  }
  if (b.money !== a.money) out.push({ label: '자금', d: b.money! - a.money!, money: true });
  if (b.injury! > a.injury!)
    out.push({ label: '부상', d: b.injury! - a.injury!, text: `${b.injury}경기 결장`, bad: true });
  if (b.potB! > a.potB!) out.push({ label: '잠재력', d: 1, text: '상승' });
  return out;
}
